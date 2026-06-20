import { getDb } from '@db/core/db'
import type { UserContextEntry } from '@features/context/types'

export async function insertContext(entry: UserContextEntry): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    `INSERT INTO user_context
      (id,user_id,kind,content,pinned,created_at,updated_at,deleted_at,synced_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      entry.id,
      entry.user_id,
      entry.kind,
      entry.content,
      entry.pinned,
      entry.created_at,
      entry.updated_at,
      entry.deleted_at,
      entry.synced_at,
    ]
  )
}

export async function updateContext(id: string, patch: Partial<UserContextEntry>): Promise<void> {
  const db = await getDb()
  const fields = Object.keys(patch).filter((k) => k !== 'id')
  if (fields.length === 0) return
  const sets = fields.map((f) => `${f} = ?`).join(', ')
  const vals = fields.map((f) => (patch as Record<string, string | number | null>)[f] ?? null)
  await db.runAsync(`UPDATE user_context SET ${sets} WHERE id = ?`, [...vals, id])
}

export async function softDeleteContext(id: string, deletedAt: string): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    `UPDATE user_context SET deleted_at = ?, updated_at = ? WHERE id = ?`,
    [deletedAt, deletedAt, id]
  )
}

export async function restoreContext(id: string, restoredAt: string): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    `UPDATE user_context SET deleted_at = NULL, updated_at = ? WHERE id = ?`,
    [restoredAt, id]
  )
}

export async function getContext(id: string, userId: string | null): Promise<UserContextEntry | null> {
  const db = await getDb()
  return db.getFirstAsync<UserContextEntry>(
    `SELECT * FROM user_context WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    [id, userId]
  )
}

export async function getContextIncludingDeleted(id: string, userId: string | null): Promise<UserContextEntry | null> {
  const db = await getDb()
  return db.getFirstAsync<UserContextEntry>(
    `SELECT * FROM user_context WHERE id = ? AND user_id = ?`,
    [id, userId]
  )
}

export async function listContext(userId: string | null): Promise<UserContextEntry[]> {
  const db = await getDb()
  return db.getAllAsync<UserContextEntry>(
    `SELECT * FROM user_context
     WHERE deleted_at IS NULL AND user_id = ?
     ORDER BY pinned DESC, updated_at DESC`,
    [userId]
  )
}

export async function wipeContext(userId: string | null): Promise<number> {
  const db = await getDb()
  const r = await db.runAsync(`DELETE FROM user_context WHERE user_id = ?`, [userId])
  return r.changes
}

export async function exportContextData(userId: string | null): Promise<UserContextEntry[]> {
  const db = await getDb()
  return db.getAllAsync<UserContextEntry>(
    `SELECT * FROM user_context WHERE deleted_at IS NULL AND user_id = ? ORDER BY updated_at DESC`,
    [userId]
  )
}
