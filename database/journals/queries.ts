import { getDb } from '@db/core/db'
import type { Journal } from '@features/journals/types'

export async function insertJournal(j: Journal): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    `INSERT INTO journal
      (id,user_id,content,mood,occurred_at,
       location_lat,location_lng,location_label,
       created_at,updated_at,deleted_at,synced_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [j.id, j.user_id, j.content, j.mood ?? null, j.occurred_at,
     j.location_lat ?? null, j.location_lng ?? null, j.location_label ?? null,
     j.created_at, j.updated_at, null, null]
  )
}

export async function updateJournal(id: string, patch: Partial<Journal>): Promise<void> {
  const db = await getDb()
  const fields = Object.keys(patch).filter((k) => k !== 'id')
  if (fields.length === 0) return
  const sets = fields.map((f) => `${f} = ?`).join(', ')
  const vals = fields.map((f) => (patch as any)[f])
  await db.runAsync(`UPDATE journal SET ${sets} WHERE id = ?`, [...vals, id])
}

export async function softDeleteJournal(id: string, deletedAt: string): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    `UPDATE journal SET deleted_at = ?, updated_at = ? WHERE id = ?`,
    [deletedAt, deletedAt, id]
  )
}

export async function getJournal(id: string): Promise<Journal | null> {
  const db = await getDb()
  return db.getFirstAsync<Journal>(
    `SELECT * FROM journal WHERE id = ? AND deleted_at IS NULL`, [id]
  )
}

export async function listJournals(): Promise<Journal[]> {
  const db = await getDb()
  return db.getAllAsync<Journal>(
    `SELECT * FROM journal WHERE deleted_at IS NULL ORDER BY occurred_at DESC`
  )
}

export async function wipeJournals(): Promise<number> {
  const db = await getDb()
  const r = await db.runAsync(`DELETE FROM journal`)
  return r.changes
}

export async function exportJournalsData(): Promise<Journal[]> {
  const db = await getDb()
  return db.getAllAsync<Journal>(
    `SELECT * FROM journal WHERE deleted_at IS NULL ORDER BY occurred_at DESC`
  )
}
