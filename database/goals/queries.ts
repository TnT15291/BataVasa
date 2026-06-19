import { getDb } from '@db/core/db'
import type { Goal } from '@features/goals/types'

export async function insertGoal(goal: Goal): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    `INSERT INTO goal
      (id,user_id,title,description,target_type,target_value,unit,start_date,due_date,
       metric_binding,status,created_at,updated_at,deleted_at,synced_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      goal.id,
      goal.user_id,
      goal.title,
      goal.description,
      goal.target_type,
      goal.target_value,
      goal.unit,
      goal.start_date,
      goal.due_date,
      goal.metric_binding,
      goal.status,
      goal.created_at,
      goal.updated_at,
      goal.deleted_at,
      goal.synced_at,
    ]
  )
}

export async function updateGoal(id: string, patch: Partial<Goal>): Promise<void> {
  const db = await getDb()
  const fields = Object.keys(patch).filter((k) => k !== 'id')
  if (fields.length === 0) return
  const sets = fields.map((f) => `${f} = ?`).join(', ')
  const vals = fields.map((f) => (patch as any)[f])
  await db.runAsync(`UPDATE goal SET ${sets} WHERE id = ?`, [...vals, id])
}

export async function softDeleteGoal(id: string, deletedAt: string): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    `UPDATE goal SET deleted_at = ?, updated_at = ? WHERE id = ?`,
    [deletedAt, deletedAt, id]
  )
}

export async function restoreGoal(id: string, restoredAt: string): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    `UPDATE goal SET deleted_at = NULL, updated_at = ? WHERE id = ?`,
    [restoredAt, id]
  )
}

export async function getGoal(id: string, userId: string | null): Promise<Goal | null> {
  const db = await getDb()
  return db.getFirstAsync<Goal>(
    `SELECT * FROM goal WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    [id, userId]
  )
}

export async function getGoalIncludingDeleted(id: string, userId: string | null): Promise<Goal | null> {
  const db = await getDb()
  return db.getFirstAsync<Goal>(
    `SELECT * FROM goal WHERE id = ? AND user_id = ?`,
    [id, userId]
  )
}

export async function listGoals(userId: string | null): Promise<Goal[]> {
  const db = await getDb()
  return db.getAllAsync<Goal>(
    `SELECT * FROM goal
     WHERE deleted_at IS NULL AND user_id = ?
     ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 WHEN 'done' THEN 2 ELSE 3 END,
              COALESCE(due_date, '9999-12-31') ASC,
              created_at DESC`,
    [userId]
  )
}

export async function wipeGoals(userId: string | null): Promise<number> {
  const db = await getDb()
  const r = await db.runAsync(`DELETE FROM goal WHERE user_id = ?`, [userId])
  return r.changes
}

export async function exportGoalsData(userId: string | null): Promise<Goal[]> {
  const db = await getDb()
  return db.getAllAsync<Goal>(
    `SELECT * FROM goal WHERE deleted_at IS NULL AND user_id = ? ORDER BY updated_at DESC`,
    [userId]
  )
}
