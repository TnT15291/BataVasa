import { ok, appErr, type Result, type AppError } from '@services/result'
import { uuid } from '@services/uuid'
import { logger } from '@services/logger'
import { getCurrentUserId } from '@services/identity'
import { nowIso } from '@db/core/db'
import * as q from '@db/habits/queries'
import {
  CreateHabitInputSchema,
  UpdateHabitInputSchema,
  CreateHabitLogInputSchema,
  type CreateHabitInput,
  type UpdateHabitInput,
  type CreateHabitLogInput,
  type Habit,
  type HabitLog,
} from './types'

const MODULE = 'habits.service'

export async function createHabit(
  input: CreateHabitInput
): Promise<Result<Habit, AppError>> {
  const parsed = CreateHabitInputSchema.safeParse(input)
  if (!parsed.success) {
    return appErr('VALIDATION_FAILED', parsed.error.issues[0]?.message ?? 'Invalid input', parsed.error)
  }
  const data = parsed.data
  try {
    const habit: Habit = {
      id: uuid(),
      user_id: getCurrentUserId(),
      name: data.name,
      icon: data.icon,
      color: data.color,
      cadence: data.cadence,
      target_per_period: data.target_per_period,
      location_lat: data.location_lat ?? null,
      location_lng: data.location_lng ?? null,
      location_label: data.location_label ?? null,
      created_at: nowIso(),
      updated_at: nowIso(),
      deleted_at: null,
      synced_at: null,
    }
    await q.insertHabit(habit)
    logger.info(MODULE, 'habit created', { id: habit.id })
    return ok(habit)
  } catch (e) {
    logger.error(MODULE, 'createHabit failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to create habit', e)
  }
}

export async function updateHabit(
  input: UpdateHabitInput
): Promise<Result<Habit, AppError>> {
  const parsed = UpdateHabitInputSchema.safeParse(input)
  if (!parsed.success) {
    return appErr('VALIDATION_FAILED', parsed.error.issues[0]?.message ?? 'Invalid input', parsed.error)
  }
  const data = parsed.data
  try {
    const existing = await q.getHabit(data.id)
    if (!existing) return appErr('NOT_FOUND', 'Habit not found')

    const patch: Partial<Habit> = { updated_at: nowIso() }
    if (data.name !== undefined) patch.name = data.name
    if (data.icon !== undefined) patch.icon = data.icon
    if (data.color !== undefined) patch.color = data.color
    if (data.cadence !== undefined) patch.cadence = data.cadence
    if (data.target_per_period !== undefined) patch.target_per_period = data.target_per_period

    await q.updateHabit(data.id, patch)
    const fresh = await q.getHabit(data.id)
    if (!fresh) return appErr('INTERNAL', 'Updated habit vanished')
    return ok(fresh)
  } catch (e) {
    logger.error(MODULE, 'updateHabit failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to update habit', e)
  }
}

export async function deleteHabit(id: string): Promise<Result<void, AppError>> {
  try {
    const existing = await q.getHabit(id)
    if (!existing) return appErr('NOT_FOUND', 'Habit not found')
    await q.softDeleteHabit(id, nowIso())
    logger.info(MODULE, 'habit deleted', { id })
    return ok(undefined)
  } catch (e) {
    logger.error(MODULE, 'deleteHabit failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to delete habit', e)
  }
}

export async function loadHabits(): Promise<Result<Habit[], AppError>> {
  try {
    const habits = await q.listHabits()
    return ok(habits)
  } catch (e) {
    logger.error(MODULE, 'loadHabits failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to load habits', e)
  }
}

export async function wipeAllHabits(): Promise<Result<{ deleted: number }, AppError>> {
  try {
    const deleted = await q.wipeHabits()
    logger.info(MODULE, 'wiped all habits', { deleted })
    return ok({ deleted })
  } catch (e) {
    logger.error(MODULE, 'wipeAllHabits failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to wipe habits', e)
  }
}

export async function exportAllHabits(): Promise<Result<string, AppError>> {
  try {
    const data = await q.exportHabitsData()
    return ok(JSON.stringify({ exported_at: new Date().toISOString(), ...data }, null, 2))
  } catch (e) {
    logger.error(MODULE, 'exportAllHabits failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to export habits', e)
  }
}

// ── Logs ─────────────────────────────────────────────────────────────────────

export async function logHabit(
  input: CreateHabitLogInput
): Promise<Result<HabitLog, AppError>> {
  const parsed = CreateHabitLogInputSchema.safeParse(input)
  if (!parsed.success) {
    return appErr('VALIDATION_FAILED', parsed.error.issues[0]?.message ?? 'Invalid input', parsed.error)
  }
  const data = parsed.data
  try {
    const log: HabitLog = {
      id: uuid(),
      habit_id: data.habit_id,
      user_id: getCurrentUserId(),
      occurred_at: data.occurred_at,
      note: data.note ?? null,
      created_at: nowIso(),
      updated_at: nowIso(),
      deleted_at: null,
      synced_at: null,
    }
    await q.insertHabitLog(log)
    logger.info(MODULE, 'habit logged', { habit_id: data.habit_id })
    return ok(log)
  } catch (e) {
    logger.error(MODULE, 'logHabit failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to log habit', e)
  }
}

export async function unlogHabit(
  habitId: string,
  dateStr: string
): Promise<Result<void, AppError>> {
  try {
    const log = await q.getLogForDate(habitId, dateStr)
    if (!log) return ok(undefined)
    await q.softDeleteHabitLog(log.id, nowIso())
    logger.info(MODULE, 'habit unlogged', { habit_id: habitId, date: dateStr })
    return ok(undefined)
  } catch (e) {
    logger.error(MODULE, 'unlogHabit failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to unlog habit', e)
  }
}

export async function getHabitStreak(habitId: string): Promise<number> {
  try {
    const today = new Date()
    const toDate = today.toISOString().split('T')[0]!
    // Look back up to 365 days
    const from = new Date(today)
    from.setDate(from.getDate() - 365)
    const fromDate = from.toISOString().split('T')[0]!

    const logsByDate = await q.listLogCountsByDate(habitId, fromDate, toDate)
    const logMap = new Map(logsByDate.map((r) => [r.date, r.count]))

    let streak = 0
    const cur = new Date(today)
    while (true) {
      const dateStr = cur.toISOString().split('T')[0]!
      if ((logMap.get(dateStr) ?? 0) >= 1) {
        streak++
        cur.setDate(cur.getDate() - 1)
      } else {
        break
      }
    }
    return streak
  } catch {
    return 0
  }
}

export async function getTodayLogCount(habitId: string): Promise<number> {
  try {
    const dateStr = new Date().toISOString().split('T')[0]!
    return q.countLogsForDate(habitId, dateStr)
  } catch {
    return 0
  }
}
