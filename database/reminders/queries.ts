import { getDb } from '@db/core/db'
import type { Reminder } from '@features/reminders/types'

export async function insertReminder(r: Reminder): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    `INSERT INTO reminder
      (id,user_id,title,note,remind_at,advance_minutes,recurrence,priority,is_inbox,completed,
       location_lat,location_lng,location_label,
       created_at,updated_at,deleted_at,synced_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [r.id, r.user_id, r.title, r.note ?? null, r.remind_at, r.advance_minutes ?? 0,
     r.recurrence, r.priority ?? 'medium', r.is_inbox ?? 0, r.completed, r.location_lat ?? null, r.location_lng ?? null,
     r.location_label ?? null, r.created_at, r.updated_at, null, null]
  )
}

export async function updateReminder(id: string, patch: Partial<Reminder>): Promise<void> {
  const db = await getDb()
  const fields = Object.keys(patch).filter((k) => k !== 'id')
  if (fields.length === 0) return
  const sets = fields.map((f) => `${f} = ?`).join(', ')
  const vals = fields.map((f) => (patch as any)[f])
  await db.runAsync(`UPDATE reminder SET ${sets} WHERE id = ?`, [...vals, id])
}

export async function softDeleteReminder(id: string, deletedAt: string): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    `UPDATE reminder SET deleted_at = ?, updated_at = ? WHERE id = ?`,
    [deletedAt, deletedAt, id]
  )
}

export async function restoreReminder(id: string, restoredAt: string): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    `UPDATE reminder SET deleted_at = NULL, updated_at = ? WHERE id = ?`,
    [restoredAt, id]
  )
}

export async function getReminder(id: string, userId: string | null): Promise<Reminder | null> {
  const db = await getDb()
  return db.getFirstAsync<Reminder>(
    `SELECT * FROM reminder WHERE id = ? AND user_id = ? AND deleted_at IS NULL`, [id, userId]
  )
}

export async function getReminderIncludingDeleted(id: string, userId: string | null): Promise<Reminder | null> {
  const db = await getDb()
  return db.getFirstAsync<Reminder>(
    `SELECT * FROM reminder WHERE id = ? AND user_id = ?`, [id, userId]
  )
}

export async function listReminders(userId: string | null): Promise<Reminder[]> {
  const db = await getDb()
  return db.getAllAsync<Reminder>(
    `SELECT * FROM reminder WHERE deleted_at IS NULL AND user_id = ? ORDER BY remind_at ASC`, [userId]
  )
}

export async function wipeReminders(userId: string | null): Promise<number> {
  const db = await getDb()
  const r = await db.runAsync(`DELETE FROM reminder WHERE user_id = ?`, [userId])
  return r.changes
}

export async function exportRemindersData(userId: string | null): Promise<Reminder[]> {
  const db = await getDb()
  return db.getAllAsync<Reminder>(
    `SELECT * FROM reminder WHERE deleted_at IS NULL AND user_id = ? ORDER BY remind_at ASC`, [userId]
  )
}
