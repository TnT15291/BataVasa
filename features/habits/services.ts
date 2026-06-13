import { ok, appErr, type Result, type AppError } from '@services/result'
import { uuid } from '@services/uuid'
import { logger } from '@services/logger'
import { getCurrentUserId } from '@services/identity'
import { nowIso } from '@db/core/db'
import * as q from '@db/habits/queries'
import { enqueue } from '@db/sync/queue'
import { track } from '@services/analytics'
import { scheduleHabitNotifications, cancelHabitNotifications } from '@services/notifications'
import { getTranslations } from '@services/i18n'
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

export function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getHabitPeriodRange(
  habit: Pick<Habit, 'cadence'>,
  date = new Date()
): { from: Date; to: Date } {
  const from = new Date(date)
  from.setHours(0, 0, 0, 0)

  if (habit.cadence === 'weekly') {
    const daysSinceMonday = (from.getDay() + 6) % 7
    from.setDate(from.getDate() - daysSinceMonday)
    const to = new Date(from)
    to.setDate(to.getDate() + 7)
    return { from, to }
  }

  if (habit.cadence === 'monthly') {
    from.setDate(1)
    const to = new Date(from)
    to.setMonth(to.getMonth() + 1)
    return { from, to }
  }

  const to = new Date(from)
  to.setDate(to.getDate() + 1)
  return { from, to }
}

export function isHabitDueOnDate(habit: Pick<Habit, 'cadence' | 'schedule_days'>, date: Date): boolean {
  const day = date.getDay()
  if (habit.cadence === 'weekdays') return day >= 1 && day <= 5
  if (habit.cadence === 'custom') {
    const days = (habit.schedule_days ?? '')
      .split(',')
      .map((v) => Number(v))
      .filter((v) => Number.isInteger(v) && v >= 0 && v <= 6)
    return days.length === 0 ? true : days.includes(day)
  }
  return true
}

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
      schedule_days: data.cadence === 'custom' ? data.schedule_days ?? null : null,
      notification_times: data.notification_times ?? null,
      location_lat: data.location_lat ?? null,
      location_lng: data.location_lng ?? null,
      location_label: data.location_label ?? null,
      created_at: nowIso(),
      updated_at: nowIso(),
      deleted_at: null,
      synced_at: null,
    }
    await q.insertHabit(habit)
    if (habit.notification_times) {
      const times: string[] = JSON.parse(habit.notification_times)
      void scheduleHabitNotifications(habit.id, habit.name, times, getTranslations().habit_notification_body)
    }
    void enqueue('habit', habit.id, 'upsert')
    track('feature_used', { feature_name: 'habit_created' })
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
    const existing = await q.getHabit(data.id, getCurrentUserId())
    if (!existing) return appErr('NOT_FOUND', 'Habit not found')

    const patch: Partial<Habit> = { updated_at: nowIso() }
    if (data.name !== undefined) patch.name = data.name
    if (data.icon !== undefined) patch.icon = data.icon
    if (data.color !== undefined) patch.color = data.color
    if (data.cadence !== undefined) patch.cadence = data.cadence
    if (data.target_per_period !== undefined) patch.target_per_period = data.target_per_period
    if (data.schedule_days !== undefined || data.cadence !== undefined) {
      patch.schedule_days = (data.cadence ?? existing.cadence) === 'custom' ? data.schedule_days ?? existing.schedule_days ?? null : null
    }
    if (data.notification_times !== undefined) patch.notification_times = data.notification_times ?? null

    await q.updateHabit(data.id, patch)

    if (data.notification_times !== undefined) {
      await cancelHabitNotifications(data.id)
      const newTimes: string[] = data.notification_times ? JSON.parse(data.notification_times) : []
      const habitName = data.name ?? existing.name
      void scheduleHabitNotifications(data.id, habitName, newTimes, getTranslations().habit_notification_body)
    } else if (data.name !== undefined && existing.notification_times) {
      await cancelHabitNotifications(data.id)
      const times: string[] = JSON.parse(existing.notification_times)
      void scheduleHabitNotifications(data.id, data.name, times, getTranslations().habit_notification_body)
    }

    void enqueue('habit', data.id, 'upsert')
    const fresh = await q.getHabit(data.id, getCurrentUserId())
    if (!fresh) return appErr('INTERNAL', 'Updated habit vanished')
    return ok(fresh)
  } catch (e) {
    logger.error(MODULE, 'updateHabit failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to update habit', e)
  }
}

export async function deleteHabit(id: string): Promise<Result<void, AppError>> {
  try {
    const existing = await q.getHabit(id, getCurrentUserId())
    if (!existing) return appErr('NOT_FOUND', 'Habit not found')
    await q.softDeleteHabit(id, nowIso())
    void cancelHabitNotifications(id)
    void enqueue('habit', id, 'upsert')
    logger.info(MODULE, 'habit deleted', { id })
    return ok(undefined)
  } catch (e) {
    logger.error(MODULE, 'deleteHabit failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to delete habit', e)
  }
}

export async function restoreHabit(id: string): Promise<Result<Habit, AppError>> {
  try {
    const existing = await q.getHabitIncludingDeleted(id, getCurrentUserId())
    if (!existing) return appErr('NOT_FOUND', 'Habit not found')
    await q.restoreHabit(id, nowIso())
    if (existing.notification_times) {
      const times: string[] = JSON.parse(existing.notification_times)
      void scheduleHabitNotifications(existing.id, existing.name, times, getTranslations().habit_notification_body)
    }
    void enqueue('habit', id, 'upsert')
    const fresh = await q.getHabit(id, getCurrentUserId())
    if (!fresh) return appErr('INTERNAL', 'Restored habit vanished')
    logger.info(MODULE, 'habit restored', { id })
    return ok(fresh)
  } catch (e) {
    logger.error(MODULE, 'restoreHabit failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to restore habit', e)
  }
}

export async function loadHabits(): Promise<Result<Habit[], AppError>> {
  try {
    const habits = await q.listHabits(getCurrentUserId())
    return ok(habits)
  } catch (e) {
    logger.error(MODULE, 'loadHabits failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to load habits', e)
  }
}

export async function wipeAllHabits(): Promise<Result<{ deleted: number }, AppError>> {
  try {
    const habits = await q.listHabits(getCurrentUserId())
    for (const habit of habits) {
      if (habit.notification_times) void cancelHabitNotifications(habit.id)
    }
    const deleted = await q.wipeHabits(getCurrentUserId())
    void enqueue('habit', 'ALL', 'wipe')
    void enqueue('habit_log', 'ALL', 'wipe')
    logger.info(MODULE, 'wiped all habits', { deleted })
    return ok({ deleted })
  } catch (e) {
    logger.error(MODULE, 'wipeAllHabits failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to wipe habits', e)
  }
}

export async function exportAllHabits(): Promise<Result<string, AppError>> {
  try {
    const data = await q.exportHabitsData(getCurrentUserId())
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
      skipped: data.skipped ?? 0,
      created_at: nowIso(),
      updated_at: nowIso(),
      deleted_at: null,
      synced_at: null,
    }
    await q.insertHabitLog(log)
    void enqueue('habit_log', log.id, 'upsert')
    track('feature_used', { feature_name: 'habit_logged' })
    logger.info(MODULE, 'habit logged', { habit_id: data.habit_id })
    return ok(log)
  } catch (e) {
    logger.error(MODULE, 'logHabit failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to log habit', e)
  }
}

export async function skipHabit(
  habitId: string,
  dateStr: string
): Promise<Result<HabitLog, AppError>> {
  try {
    const existing = await q.getLogForDate(habitId, dateStr)
    if (existing) return ok(existing)
    const log: HabitLog = {
      id: uuid(),
      habit_id: habitId,
      user_id: getCurrentUserId(),
      occurred_at: new Date(`${dateStr}T12:00:00.000Z`).toISOString(),
      note: 'Skipped',
      skipped: 1,
      created_at: nowIso(),
      updated_at: nowIso(),
      deleted_at: null,
      synced_at: null,
    }
    await q.insertHabitLog(log)
    void enqueue('habit_log', log.id, 'upsert')
    track('feature_used', { feature_name: 'habit_skipped' })
    return ok(log)
  } catch (e) {
    logger.error(MODULE, 'skipHabit failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to skip habit', e)
  }
}

export async function unlogHabit(
  habitId: string,
  dateStrOrRange: string | { fromIso: string; toIso: string }
): Promise<Result<void, AppError>> {
  try {
    const log = typeof dateStrOrRange === 'string'
      ? await q.getLogForDate(habitId, dateStrOrRange)
      : await q.getLatestLogInRange(habitId, dateStrOrRange.fromIso, dateStrOrRange.toIso)
    if (!log) return ok(undefined)
    await q.softDeleteHabitLog(log.id, nowIso())
    void enqueue('habit_log', log.id, 'upsert')
    logger.info(MODULE, 'habit unlogged', { habit_id: habitId })
    return ok(undefined)
  } catch (e) {
    logger.error(MODULE, 'unlogHabit failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to unlog habit', e)
  }
}

/** All habit logs from the last `days` days, across habits (for cross-module analysis). */
export async function listRecentLogs(days = 30): Promise<Result<HabitLog[], AppError>> {
  try {
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const rows = await q.listLogsSince(getCurrentUserId(), from)
    return ok(rows)
  } catch (e) {
    logger.error(MODULE, 'listRecentLogs failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to load habit logs', e)
  }
}

export async function getHabitStreak(habitId: string): Promise<number> {
  try {
    const today = new Date()
    const toDate = getLocalDateString(today)
    // Look back up to 365 days
    const from = new Date(today)
    from.setDate(from.getDate() - 365)
    const fromDate = getLocalDateString(from)

    const logsByDate = await q.listLogCountsByDate(habitId, fromDate, toDate)
    const habit = await q.getHabit(habitId, getCurrentUserId())
    if (!habit) return 0
    const logMap = new Map(logsByDate.map((r) => [r.date, r.count]))

    let streak = 0
    const cur = new Date(today)
    while (true) {
      const dateStr = getLocalDateString(cur)
      if (!isHabitDueOnDate(habit, cur)) {
        cur.setDate(cur.getDate() - 1)
      } else if ((logMap.get(dateStr) ?? 0) >= 1) {
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
    const dateStr = getLocalDateString()
    return await q.countLogsForDate(habitId, dateStr)
  } catch {
    return 0
  }
}

export async function rescheduleAllHabitNotifications(): Promise<void> {
  try {
    const habits = await q.listHabits(getCurrentUserId())
    const body = getTranslations().habit_notification_body
    for (const habit of habits) {
      if (!habit.notification_times) continue
      await cancelHabitNotifications(habit.id)
      const times: string[] = JSON.parse(habit.notification_times)
      void scheduleHabitNotifications(habit.id, habit.name, times, body)
    }
  } catch (e) {
    logger.error(MODULE, 'rescheduleAllHabitNotifications failed', { error: String(e) })
  }
}

export async function getCurrentPeriodLogCount(habit: Pick<Habit, 'id' | 'cadence'>): Promise<number> {
  try {
    const range = getHabitPeriodRange(habit)
    return await q.countLogsInRange(habit.id, range.from.toISOString(), range.to.toISOString())
  } catch {
    return 0
  }
}

export async function getHabit30DayScore(
  habit: Pick<Habit, 'id' | 'cadence' | 'schedule_days' | 'target_per_period'>
): Promise<number> {
  try {
    const today = new Date()
    const toDate = getLocalDateString(today)
    const from = new Date(today)
    from.setDate(from.getDate() - 29)
    const fromDate = getLocalDateString(from)

    const logsByDate = await q.listLogCountsByDate(habit.id, fromDate, toDate)
    const logMap = new Map(logsByDate.map((r) => [r.date, r.count]))

    let expectedDays = 0
    let completedDays = 0
    const cur = new Date(from)
    while (cur <= today) {
      if (isHabitDueOnDate(habit, cur)) {
        expectedDays++
        const dateStr = getLocalDateString(cur)
        if ((logMap.get(dateStr) ?? 0) >= habit.target_per_period) completedDays++
      }
      cur.setDate(cur.getDate() + 1)
    }
    return expectedDays > 0 ? Math.round((completedDays / expectedDays) * 100) : 0
  } catch {
    return 0
  }
}
