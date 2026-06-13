import { getDb } from '@db/core/db'
import type { Habit, HabitLog } from '@features/habits/types'

// ── Habits ────────────────────────────────────────────────────────────────────

export async function insertHabit(h: Habit): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    `INSERT INTO habit
      (id,user_id,name,icon,color,cadence,target_per_period,schedule_days,notification_times,
       location_lat,location_lng,location_label,
       created_at,updated_at,deleted_at,synced_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [h.id, h.user_id, h.name, h.icon, h.color, h.cadence, h.target_per_period, h.schedule_days ?? null,
     h.notification_times ?? null,
     h.location_lat ?? null, h.location_lng ?? null, h.location_label ?? null,
     h.created_at, h.updated_at, null, null]
  )
}

export async function updateHabit(id: string, patch: Partial<Habit>): Promise<void> {
  const db = await getDb()
  const fields = Object.keys(patch).filter((k) => k !== 'id')
  if (fields.length === 0) return
  const sets = fields.map((f) => `${f} = ?`).join(', ')
  const vals = fields.map((f) => (patch as any)[f])
  await db.runAsync(`UPDATE habit SET ${sets} WHERE id = ?`, [...vals, id])
}

export async function softDeleteHabit(id: string, deletedAt: string): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    `UPDATE habit SET deleted_at = ?, updated_at = ? WHERE id = ?`,
    [deletedAt, deletedAt, id]
  )
}

export async function restoreHabit(id: string, restoredAt: string): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    `UPDATE habit SET deleted_at = NULL, updated_at = ? WHERE id = ?`,
    [restoredAt, id]
  )
}

export async function getHabit(id: string, userId: string | null): Promise<Habit | null> {
  const db = await getDb()
  return db.getFirstAsync<Habit>(
    `SELECT * FROM habit WHERE id = ? AND user_id = ? AND deleted_at IS NULL`, [id, userId]
  )
}

export async function getHabitIncludingDeleted(id: string, userId: string | null): Promise<Habit | null> {
  const db = await getDb()
  return db.getFirstAsync<Habit>(
    `SELECT * FROM habit WHERE id = ? AND user_id = ?`, [id, userId]
  )
}

export async function listHabits(userId: string | null): Promise<Habit[]> {
  const db = await getDb()
  return db.getAllAsync<Habit>(
    `SELECT * FROM habit WHERE deleted_at IS NULL AND user_id = ? ORDER BY created_at ASC`, [userId]
  )
}

export async function wipeHabits(userId: string | null): Promise<number> {
  const db = await getDb()
  await db.runAsync(`DELETE FROM habit_log WHERE user_id = ?`, [userId])
  const r = await db.runAsync(`DELETE FROM habit WHERE user_id = ?`, [userId])
  return r.changes
}

export async function exportHabitsData(userId: string | null): Promise<{ habits: Habit[]; logs: HabitLog[] }> {
  const db = await getDb()
  const habits = await db.getAllAsync<Habit>(`SELECT * FROM habit WHERE user_id = ?`, [userId])
  const logs = await db.getAllAsync<HabitLog>(`SELECT * FROM habit_log WHERE deleted_at IS NULL AND user_id = ? ORDER BY occurred_at DESC`, [userId])
  return { habits, logs }
}

// ── Habit Logs ────────────────────────────────────────────────────────────────

export async function insertHabitLog(log: HabitLog): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    `INSERT INTO habit_log (id,habit_id,user_id,occurred_at,note,skipped,created_at,updated_at,deleted_at,synced_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [log.id, log.habit_id, log.user_id, log.occurred_at, log.note ?? null,
     log.skipped ?? 0, log.created_at, log.updated_at, null, null]
  )
}

export async function softDeleteHabitLog(id: string, deletedAt: string): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    `UPDATE habit_log SET deleted_at = ?, updated_at = ? WHERE id = ?`,
    [deletedAt, deletedAt, id]
  )
}

export async function listLogsForHabit(habitId: string): Promise<HabitLog[]> {
  const db = await getDb()
  return db.getAllAsync<HabitLog>(
    `SELECT * FROM habit_log WHERE habit_id = ? AND deleted_at IS NULL ORDER BY occurred_at DESC`,
    [habitId]
  )
}

// All of the user's habit logs since `fromIso`, across habits — feeds the
// cross-module habit↔mood↔spending correlation analysis.
export async function listLogsSince(userId: string | null, fromIso: string): Promise<HabitLog[]> {
  const db = await getDb()
  return db.getAllAsync<HabitLog>(
    `SELECT * FROM habit_log
     WHERE user_id = ? AND deleted_at IS NULL
       AND occurred_at >= ?
     ORDER BY occurred_at DESC`,
    [userId, fromIso]
  )
}

export async function countLogsForDate(habitId: string, dateStr: string): Promise<number> {
  const db = await getDb()
  const row = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM habit_log
     WHERE habit_id = ? AND deleted_at IS NULL
       AND COALESCE(skipped, 0) = 0
       AND substr(occurred_at, 1, 10) = ?`,
    [habitId, dateStr]
  )
  return row?.cnt ?? 0
}

export async function countLogsInRange(
  habitId: string,
  fromIso: string,
  toIso: string
): Promise<number> {
  const db = await getDb()
  const row = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM habit_log
     WHERE habit_id = ? AND deleted_at IS NULL
       AND COALESCE(skipped, 0) = 0
       AND occurred_at >= ?
       AND occurred_at < ?`,
    [habitId, fromIso, toIso]
  )
  return row?.cnt ?? 0
}

export async function getLogForDate(habitId: string, dateStr: string): Promise<HabitLog | null> {
  const db = await getDb()
  return db.getFirstAsync<HabitLog>(
    `SELECT * FROM habit_log
     WHERE habit_id = ? AND deleted_at IS NULL
       AND substr(occurred_at, 1, 10) = ?
     LIMIT 1`,
    [habitId, dateStr]
  )
}

export async function getLatestLogInRange(
  habitId: string,
  fromIso: string,
  toIso: string
): Promise<HabitLog | null> {
  const db = await getDb()
  return db.getFirstAsync<HabitLog>(
    `SELECT * FROM habit_log
     WHERE habit_id = ? AND deleted_at IS NULL
       AND occurred_at >= ?
       AND occurred_at < ?
     ORDER BY occurred_at DESC
     LIMIT 1`,
    [habitId, fromIso, toIso]
  )
}

// Returns count of logs per date for last N days (for streak calculation)
export async function listLogCountsByDate(
  habitId: string,
  fromDate: string,
  toDate: string
): Promise<{ date: string; count: number }[]> {
  const db = await getDb()
  return db.getAllAsync<{ date: string; count: number }>(
    `SELECT substr(occurred_at, 1, 10) as date, COUNT(*) as count
     FROM habit_log
     WHERE habit_id = ? AND deleted_at IS NULL
       AND COALESCE(skipped, 0) = 0
       AND substr(occurred_at, 1, 10) >= ?
       AND substr(occurred_at, 1, 10) <= ?
     GROUP BY substr(occurred_at, 1, 10)`,
    [habitId, fromDate, toDate]
  )
}
