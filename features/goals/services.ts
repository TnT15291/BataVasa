import { ok, appErr, type Result, type AppError } from '@services/result'
import { uuid } from '@services/uuid'
import { logger } from '@services/logger'
import { getCurrentUserId } from '@services/identity'
import { nowIso } from '@db/core/db'
import { enqueue } from '@db/sync/queue'
import { calculateGoalProgress, parseGoalBinding } from '@services/goalProgress'
import * as q from '@db/goals/queries'
import {
  CreateGoalInputSchema,
  UpdateGoalInputSchema,
  type CreateGoalInput,
  type UpdateGoalInput,
  type Goal,
  type GoalWithProgress,
} from './types'

const MODULE = 'goals.service'

async function hydrateGoal(goal: Goal): Promise<GoalWithProgress> {
  return {
    ...goal,
    binding: parseGoalBinding(goal.metric_binding),
    progress: await calculateGoalProgress(goal),
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
    const goal: Goal = {
      id: uuid(),
      user_id: getCurrentUserId(),
      title: data.title,
      description: data.description ?? null,
      target_type: data.target_type,
      target_value: data.target_value,
      unit: data.unit,
      start_date: data.start_date,
      due_date: data.due_date ?? null,
      metric_binding: JSON.stringify(data.metric_binding),
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
    if (data.target_type !== undefined) patch.target_type = data.target_type
    if (data.target_value !== undefined) patch.target_value = data.target_value
    if (data.unit !== undefined) patch.unit = data.unit
    if (data.start_date !== undefined) patch.start_date = data.start_date
    if (data.due_date !== undefined) patch.due_date = data.due_date ?? null
    if (data.metric_binding !== undefined) patch.metric_binding = JSON.stringify(data.metric_binding)
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
