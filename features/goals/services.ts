import { ok, appErr, type Result, type AppError } from '@services/result'
import { uuid } from '@services/uuid'
import { logger } from '@services/logger'
import { getCurrentUserId } from '@services/identity'
import { nowIso } from '@db/core/db'
import { enqueue } from '@db/sync/queue'
import { calculateGoalMeasureProgress, aggregateGoalProgress, parseGoalBinding } from '@services/goalProgress'
import * as q from '@db/goals/queries'
import {
  CreateGoalInputSchema,
  UpdateGoalInputSchema,
  type CreateGoalInput,
  type UpdateGoalInput,
  type Goal,
  type GoalMeasure,
  type GoalMetricBinding,
  type GoalStatus,
  type GoalProgress,
  type GoalWithProgress,
} from './types'

const MODULE = 'goals.service'

// A completion_rate target is a percentage of scheduled days, so it must land in
// [1,100]; anything outside (incl. an AI parser emitting a quantity) collapses to
// 100 = "every scheduled day". completion_count and all other goals keep their
// raw target. Single source of truth for habit-rate normalization.
function normalizeHabitRateTarget(targetValue: number, binding: GoalMetricBinding | null): number {
  if (binding?.module === 'habits' && binding.aggregation === 'completion_rate') {
    if (!Number.isFinite(targetValue) || targetValue <= 0) return 100
    return Math.min(100, Math.max(1, Math.round(targetValue)))
  }
  return targetValue
}

function normalizeGoalForDisplay(goal: Goal): Goal {
  const binding = parseGoalBinding(goal.metric_binding)
  const targetValue = normalizeHabitRateTarget(goal.target_value, binding)
  return targetValue === goal.target_value ? goal : { ...goal, target_value: targetValue }
}

// Clamp each measure's habit-rate target the same way the legacy primary target
// is clamped, so stored measures are always display-ready.
function normalizeMeasures(measures: GoalMeasure[]): GoalMeasure[] {
  return measures.map((m) => ({ ...m, target_value: normalizeHabitRateTarget(m.target_value, m.binding) }))
}

// The columns a goal's measures project onto: the JSON array (source of truth)
// plus the legacy single columns mirroring the first measure.
function measureColumns(measures: GoalMeasure[]): Pick<Goal, 'target_type' | 'target_value' | 'unit' | 'direction' | 'metric_binding' | 'measures'> {
  const primary = measures[0]!
  return {
    target_type: primary.target_type,
    target_value: primary.target_value,
    unit: primary.unit,
    direction: primary.direction,
    metric_binding: JSON.stringify(primary.binding),
    measures: JSON.stringify(measures),
  }
}

// When a 'reach' goal's progress hits its target, mark it done once and queue the
// change so lists, detail, reports and AI context all see the completed state.
async function autoCompleteIfReached(goal: Goal, progress: GoalProgress): Promise<GoalStatus> {
  // The aggregate reports 'reached' only when every 'reach' measure has hit its
  // target and no 'cap' is exceeded — so this covers single- and multi-measure
  // goals without inspecting the primary measure's direction.
  if (goal.status === 'active' && progress.status === 'reached') {
    await q.updateGoal(goal.id, { status: 'done', updated_at: nowIso() })
    void enqueue('goal', goal.id, 'upsert')
    return 'done'
  }
  return goal.status
}

async function hydrateGoal(goal: Goal): Promise<GoalWithProgress> {
  const normalized = normalizeGoalForDisplay(goal)
  const measureProgress = await calculateGoalMeasureProgress(normalized)
  const progress = aggregateGoalProgress(measureProgress, normalized)
  const status = await autoCompleteIfReached(normalized, progress)
  return {
    ...normalized,
    status,
    binding: measureProgress[0]?.binding ?? parseGoalBinding(normalized.metric_binding),
    progress,
    measureProgress,
  }
}

export async function loadGoals(): Promise<Result<GoalWithProgress[], AppError>> {
  try {
    const goals = await q.listGoals(getCurrentUserId())
    return ok(await Promise.all(goals.map(hydrateGoal)))
  } catch (e) {
    logger.error(MODULE, 'loadGoals failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to load goals', e)
  }
}

export async function getGoal(id: string): Promise<Result<GoalWithProgress, AppError>> {
  try {
    const goal = await q.getGoal(id, getCurrentUserId())
    if (!goal) return appErr('NOT_FOUND', 'Goal not found')
    return ok(await hydrateGoal(goal))
  } catch (e) {
    logger.error(MODULE, 'getGoal failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to load goal', e)
  }
}

export async function createGoal(input: CreateGoalInput): Promise<Result<GoalWithProgress, AppError>> {
  const parsed = CreateGoalInputSchema.safeParse(input)
  if (!parsed.success) {
    return appErr('VALIDATION_FAILED', parsed.error.issues[0]?.message ?? 'Invalid input', parsed.error)
  }
  const data = parsed.data
  try {
    const ts = nowIso()
    const measures = normalizeMeasures(data.measures)
    const goal: Goal = {
      id: uuid(),
      user_id: getCurrentUserId(),
      title: data.title,
      description: data.description ?? null,
      ...measureColumns(measures),
      start_date: data.start_date,
      due_date: data.due_date ?? null,
      status: 'active',
      created_at: ts,
      updated_at: ts,
      deleted_at: null,
      synced_at: null,
    }
    await q.insertGoal(goal)
    void enqueue('goal', goal.id, 'upsert')
    logger.info(MODULE, 'goal created', { id: goal.id })
    return ok(await hydrateGoal(goal))
  } catch (e) {
    logger.error(MODULE, 'createGoal failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to create goal', e)
  }
}

export async function updateGoal(input: UpdateGoalInput): Promise<Result<GoalWithProgress, AppError>> {
  const parsed = UpdateGoalInputSchema.safeParse(input)
  if (!parsed.success) {
    return appErr('VALIDATION_FAILED', parsed.error.issues[0]?.message ?? 'Invalid input', parsed.error)
  }
  const data = parsed.data
  try {
    const existing = await q.getGoal(data.id, getCurrentUserId())
    if (!existing) return appErr('NOT_FOUND', 'Goal not found')
    const patch: Partial<Goal> = { updated_at: nowIso() }
    if (data.title !== undefined) patch.title = data.title
    if (data.description !== undefined) patch.description = data.description ?? null
    if (data.start_date !== undefined) patch.start_date = data.start_date
    if (data.due_date !== undefined) patch.due_date = data.due_date ?? null
    if (data.measures !== undefined) Object.assign(patch, measureColumns(normalizeMeasures(data.measures)))
    if (data.status !== undefined) patch.status = data.status
    await q.updateGoal(data.id, patch)
    void enqueue('goal', data.id, 'upsert')
    const fresh = await q.getGoal(data.id, getCurrentUserId())
    if (!fresh) return appErr('INTERNAL', 'Updated goal vanished')
    return ok(await hydrateGoal(fresh))
  } catch (e) {
    logger.error(MODULE, 'updateGoal failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to update goal', e)
  }
}

export async function deleteGoal(id: string): Promise<Result<void, AppError>> {
  try {
    const existing = await q.getGoal(id, getCurrentUserId())
    if (!existing) return appErr('NOT_FOUND', 'Goal not found')
    await q.softDeleteGoal(id, nowIso())
    void enqueue('goal', id, 'upsert')
    return ok(undefined)
  } catch (e) {
    logger.error(MODULE, 'deleteGoal failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to delete goal', e)
  }
}

export async function restoreGoal(id: string): Promise<Result<GoalWithProgress, AppError>> {
  try {
    const existing = await q.getGoalIncludingDeleted(id, getCurrentUserId())
    if (!existing) return appErr('NOT_FOUND', 'Goal not found')
    await q.restoreGoal(id, nowIso())
    void enqueue('goal', id, 'upsert')
    const fresh = await q.getGoal(id, getCurrentUserId())
    if (!fresh) return appErr('INTERNAL', 'Restored goal vanished')
    return ok(await hydrateGoal(fresh))
  } catch (e) {
    logger.error(MODULE, 'restoreGoal failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to restore goal', e)
  }
}

export async function wipeAllGoals(): Promise<Result<{ deleted: number }, AppError>> {
  try {
    const deleted = await q.wipeGoals(getCurrentUserId())
    void enqueue('goal', 'ALL', 'wipe')
    return ok({ deleted })
  } catch (e) {
    logger.error(MODULE, 'wipeAllGoals failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to wipe goals', e)
  }
}

export async function exportAllGoals(): Promise<Result<string, AppError>> {
  try {
    const goals = await q.exportGoalsData(getCurrentUserId())
    return ok(JSON.stringify({ exported_at: new Date().toISOString(), goals }, null, 2))
  } catch (e) {
    logger.error(MODULE, 'exportAllGoals failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to export goals', e)
  }
}
