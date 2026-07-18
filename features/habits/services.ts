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

// The [start, nextStart) instant bounds of a local calendar day, as ISO. SQLite
// stores occurred_at in UTC, so "which day did this happen" must be resolved in
// the device timezone here — never via substr() on the UTC string, which buckets
// early-morning / late-evening logs onto the wrong day for non-UTC users.
export function localDayBoundsIso(dateStr: string): { fromIso: string; toIso: string } {
  const from = new Date(`${dateStr}T00:00:00`) // parsed in local time
  const to = new Date(from)
  to.setDate(to.getDate() + 1)
  return { fromIso: from.toISOString(), toIso: to.toISOString() }
}

// Bucket raw habit-log rows onto local calendar days: completion counts per date
// and the set of intentionally-skipped dates. The single place a stored UTC
// instant is mapped to a local day, so every caller stays timezone-correct.
export function bucketLogsByLocalDate(
  rows: { occurred_at: string; skipped?: number | null }[]
): { doneByDate: Map<string, number>; skippedDates: Set<string> } {
  const doneByDate = new Map<string, number>()
  const skippedDates = new Set<string>()
  for (const row of rows) {
    const date = getLocalDateString(new Date(row.occurred_at))
    if ((row.skipped ?? 0) === 1) skippedDates.add(date)
    else doneByDate.set(date, (doneByDate.get(date) ?? 0) + 1)
  }
  return { doneByDate, skippedDates }
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

// ── Pure stat math ────────────────────────────────────────────────────────────
// Operate on already-bucketed logs (no DB). Shared by the per-habit query
// functions below AND the batched computeHabitStats, so the two paths can never
// drift apart.

export type HabitStats = {
  todayCount: number
  streak: number
  strengthScore: number
  dueToday: boolean
  /** Scheduled yesterday but left undone (not skipped) — drives "never miss twice". */
  missedYesterday: boolean
  /** Skipped (rested) for today — resolves the entry without counting as done. */
  skippedToday: boolean
}

function computeStreakFromBuckets(
  habit: Pick<Habit, 'cadence' | 'schedule_days'>,
  doneByDate: Map<string, number>,
  skippedDates: Set<string>,
  now: Date
): number {
  let streak = 0
  const cur = new Date(now)
  // Self-terminates at the first due day with no log; bucket data only spans the
  // ~365d fetch window, so the cap is purely defensive (never reached in practice).
  for (let guard = 0; guard < 800; guard++) {
    const dateStr = getLocalDateString(cur)
    if (!isHabitDueOnDate(habit, cur)) {
      cur.setDate(cur.getDate() - 1)
    } else if ((doneByDate.get(dateStr) ?? 0) >= 1) {
      streak++
      cur.setDate(cur.getDate() - 1)
    } else if (skippedDates.has(dateStr)) {
      // Rest/skip day bridges the streak (CLAUDE: skip must not break it).
      cur.setDate(cur.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

function compute30DayScoreFromBuckets(
  habit: Pick<Habit, 'cadence' | 'schedule_days' | 'target_per_period'>,
  doneByDate: Map<string, number>,
  skippedDates: Set<string>,
  now: Date
): number {
  let expectedDays = 0
  let completedDays = 0
  const cur = new Date(now)
  cur.setDate(cur.getDate() - 29)
  while (cur <= now) {
    if (isHabitDueOnDate(habit, cur)) {
      const dateStr = getLocalDateString(cur)
      if ((doneByDate.get(dateStr) ?? 0) >= habit.target_per_period) {
        expectedDays++
        completedDays++
      } else if (!skippedDates.has(dateStr)) {
        // Skipped (rest) days are excluded from the rate entirely (skip is neutral).
        expectedDays++
      }
    }
    cur.setDate(cur.getDate() + 1)
  }
  return expectedDays > 0 ? Math.round((completedDays / expectedDays) * 100) : 0
}

/**
 * All five per-habit stats from this habit's pre-fetched log rows (last ~365d),
 * with zero DB access. Lets the store hydrate N habits from ONE log query.
 * Faithful to getCurrentPeriodLogCount / getHabitStreak / getHabit30DayScore /
 * wasHabitMissedYesterday (which share the same pure helpers).
 */
export function computeHabitStats(
  habit: Habit,
  rows: { occurred_at: string; skipped?: number | null }[],
  now: Date = new Date()
): HabitStats {
  const { doneByDate, skippedDates } = bucketLogsByLocalDate(rows)

  // todayCount — non-skipped logs within the current period (instant range,
  // exactly matching countLogsInRange which filters skipped=0).
  const period = getHabitPeriodRange(habit, now)
  const fromIso = period.from.toISOString()
  const toIso = period.to.toISOString()
  let todayCount = 0
  for (const r of rows) {
    if ((r.skipped ?? 0) === 0 && r.occurred_at >= fromIso && r.occurred_at < toIso) todayCount++
  }

  // missedYesterday — due yesterday but no log at all (neither done nor skipped),
  // mirroring wasHabitMissedYesterday (getLatestLogInRange === null).
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yIso = getLocalDateString(yesterday)
  const missedYesterday = isHabitDueOnDate(habit, yesterday)
    && (doneByDate.get(yIso) ?? 0) === 0
    && !skippedDates.has(yIso)

  return {
    todayCount,
    streak: computeStreakFromBuckets(habit, doneByDate, skippedDates, now),
    strengthScore: compute30DayScoreFromBuckets(habit, doneByDate, skippedDates, now),
    dueToday: isHabitDueOnDate(habit, now),
    missedYesterday,
    skippedToday: skippedDates.has(getLocalDateString(now)),
  }
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
      identity: data.identity ?? null,
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
    if (data.identity !== undefined) patch.identity = data.identity ?? null

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

// Logs far enough back to cover the longest streak we display (365d).
function statsWindowFromIso(now: Date): string {
  const from = new Date(now)
  from.setDate(from.getDate() - 365)
  return localDayBoundsIso(getLocalDateString(from)).fromIso
}

/**
 * Load all habits with their stats using ONE log query for the whole list (was
 * 4–5 queries per habit → N×5). Fetches every habit's logs since the stats
 * window once, groups them in memory, then computes stats per habit.
 */
export async function loadHabitsWithStats(): Promise<Result<(Habit & HabitStats)[], AppError>> {
  try {
    const userId = getCurrentUserId()
    const habits = await q.listHabits(userId)
    const now = new Date()
    const logs = await q.listLogsSince(userId, statsWindowFromIso(now))
    const byHabit = new Map<string, { occurred_at: string; skipped: number }[]>()
    for (const log of logs) {
      const list = byHabit.get(log.habit_id) ?? []
      list.push({ occurred_at: log.occurred_at, skipped: log.skipped ?? 0 })
      byHabit.set(log.habit_id, list)
    }
    return ok(habits.map((h) => ({ ...h, ...computeHabitStats(h, byHabit.get(h.id) ?? [], now) })))
  } catch (e) {
    logger.error(MODULE, 'loadHabitsWithStats failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to load habits', e)
  }
}

/** Single-habit stats in ONE query (was 4–5) — for create/update/toggle/skip refresh. */
export async function getHabitStats(habit: Habit): Promise<HabitStats> {
  try {
    const now = new Date()
    const { toIso } = localDayBoundsIso(getLocalDateString(now))
    const rows = await q.listLogRowsInRange(habit.id, statsWindowFromIso(now), toIso)
    return computeHabitStats(habit, rows, now)
  } catch {
    return { todayCount: 0, streak: 0, strengthScore: 0, dueToday: isHabitDueOnDate(habit, new Date()), missedYesterday: false, skippedToday: false }
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
    const { fromIso, toIso } = localDayBoundsIso(dateStr)
    const existing = await q.getLatestLogInRange(habitId, fromIso, toIso)
    if (existing?.skipped === 1) return ok(existing)
    const log: HabitLog = {
      id: uuid(),
      habit_id: habitId,
      user_id: getCurrentUserId(),
      occurred_at: new Date(`${dateStr}T12:00:00`).toISOString(),
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
    const { fromIso, toIso } = typeof dateStrOrRange === 'string'
      ? localDayBoundsIso(dateStrOrRange)
      : dateStrOrRange
    const log = await q.getLatestLogInRange(habitId, fromIso, toIso)
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
    // Look back up to 365 days, comparing on stored UTC instants…
    const from = new Date(today)
    from.setDate(from.getDate() - 365)
    const { fromIso } = localDayBoundsIso(getLocalDateString(from))
    const { toIso } = localDayBoundsIso(getLocalDateString(today))

    const rows = await q.listLogRowsInRange(habitId, fromIso, toIso)
    const habit = await q.getHabit(habitId, getCurrentUserId())
    if (!habit) return 0
    // …but bucket onto local calendar days here so the streak matches what the
    // user actually sees on their device.
    const { doneByDate, skippedDates } = bucketLogsByLocalDate(rows)
    return computeStreakFromBuckets(habit, doneByDate, skippedDates, today)
  } catch {
    return 0
  }
}

export async function getTodayLogCount(habitId: string): Promise<number> {
  try {
    const { fromIso, toIso } = localDayBoundsIso(getLocalDateString())
    return await q.countLogsInRange(habitId, fromIso, toIso)
  } catch {
    return 0
  }
}

/**
 * Atomic Habits "never miss twice": was this habit scheduled yesterday but left
 * with no log at all (neither done nor skipped)? Used to surface a gentle nudge
 * today so a one-day slip doesn't become two. Derived from habit_log — no schema
 * change. An intentional skip yesterday is NOT a miss.
 */
export async function wasHabitMissedYesterday(
  habit: Pick<Habit, 'id' | 'cadence' | 'schedule_days'>
): Promise<boolean> {
  try {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    if (!isHabitDueOnDate(habit, yesterday)) return false
    const { fromIso, toIso } = localDayBoundsIso(getLocalDateString(yesterday))
    const log = await q.getLatestLogInRange(habit.id, fromIso, toIso)
    return log === null
  } catch {
    return false
  }
}

/**
 * Atomic Habits "implementation intention": compose a concrete
 * "When [time], at [place], I will [habit]" statement from data the habit already
 * has (first notification time + location label + name). No schema change.
 * Returns null when there is neither a time nor a place — a bare "I will X" adds
 * nothing, so we don't show it.
 */
export function buildImplementationIntention(
  habit: Pick<Habit, 'name' | 'notification_times' | 'location_label'>,
  t: { impl_intention_full: string; impl_intention_time: string; impl_intention_place: string }
): string | null {
  const name = habit.name?.trim()
  if (!name) return null

  let time: string | null = null
  if (habit.notification_times) {
    try {
      const arr = JSON.parse(habit.notification_times) as string[]
      time = Array.isArray(arr) && arr.length > 0 ? String(arr[0]) : null
    } catch {
      time = null
    }
  }
  const place = habit.location_label?.trim() || null

  const fill = (tpl: string) =>
    tpl.replace('{{habit}}', name).replace('{{time}}', time ?? '').replace('{{place}}', place ?? '')

  if (time && place) return fill(t.impl_intention_full)
  if (time) return fill(t.impl_intention_time)
  if (place) return fill(t.impl_intention_place)
  return null
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
    const from = new Date(today)
    from.setDate(from.getDate() - 29)
    const { fromIso } = localDayBoundsIso(getLocalDateString(from))
    const { toIso } = localDayBoundsIso(getLocalDateString(today))

    const rows = await q.listLogRowsInRange(habit.id, fromIso, toIso)
    const { doneByDate, skippedDates } = bucketLogsByLocalDate(rows)
    return compute30DayScoreFromBuckets(habit, doneByDate, skippedDates, today)
  } catch {
    return 0
  }
}
