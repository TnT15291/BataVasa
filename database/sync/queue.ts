import { getDb, nowIso } from '@db/core/db'
import { uuid } from '@services/uuid'
import { logger } from '@services/logger'

export type SyncOperation = 'upsert' | 'wipe'

export type SyncQueueItem = {
  id: string
  table_name: string
  row_id: string
  operation: SyncOperation
  created_at: string
  retry_count: number
  last_error: string | null
}

const MAX_RETRIES = 3

/**
 * Queue a row for sync. For 'upsert', deduplicates by (table_name, row_id) so
 * rapid edits to the same row only keep one pending entry (INSERT OR REPLACE).
 * For 'wipe', row_id is 'ALL'.
 */
export async function enqueue(
  tableName: string,
  rowId: string,
  operation: SyncOperation
): Promise<void> {
  try {
    const db = await getDb()
    if (operation === 'upsert') {
      // REPLACE = DELETE existing + INSERT new; resets retry_count, updates created_at.
      await db.runAsync(
        `INSERT OR REPLACE INTO sync_queue (id, table_name, row_id, operation, created_at, retry_count, last_error)
         VALUES (?, ?, ?, 'upsert', ?, 0, NULL)`,
        [uuid(), tableName, rowId, nowIso()]
      )
    } else {
      await db.runAsync(
        `INSERT INTO sync_queue (id, table_name, row_id, operation, created_at)
         VALUES (?, ?, 'ALL', 'wipe', ?)`,
        [uuid(), tableName, nowIso()]
      )
    }
  } catch (e) {
    logger.warn('sync.queue', 'enqueue failed', { table_name: tableName, operation, error: String(e) })
  }
}

export async function getPending(limit = 50): Promise<SyncQueueItem[]> {
  const db = await getDb()
  return db.getAllAsync<SyncQueueItem>(
    `SELECT * FROM sync_queue WHERE retry_count < ? ORDER BY created_at ASC LIMIT ?`,
    [MAX_RETRIES, limit]
  )
}

export async function markSynced(id: string): Promise<void> {
  const db = await getDb()
  await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [id])
}

export async function markFailed(id: string, error: string): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    `UPDATE sync_queue SET retry_count = retry_count + 1, last_error = ? WHERE id = ?`,
    [error.slice(0, 500), id]
  )
}

export async function purgeFailed(): Promise<void> {
  const db = await getDb()
  await db.runAsync(`DELETE FROM sync_queue WHERE retry_count >= ?`, [MAX_RETRIES])
}

export async function clearAll(): Promise<void> {
  const db = await getDb()
  await db.runAsync(`DELETE FROM sync_queue`)
}
