import { AppState } from 'react-native'
import { supabase } from './supabase'
import { logger } from './logger'
import { getDb, nowIso } from '@db/core/db'
import * as syncQueue from '@db/sync/queue'
import { useAuthStore } from '@store/authStore'
import { useSettingsStore } from '@store/settingsStore'

const MODULE = 'sync'

// Maps each table to its settingsStore sync-toggle key.
const TABLE_MODULE: Record<string, keyof SyncToggles> = {
  finance_transaction: 'syncFinance',
  finance_category:   'syncFinance',
  finance_rule:       'syncFinance',
  habit:              'syncHabits',
  habit_log:          'syncHabits',
  journal:            'syncJournals',
  reminder:           'syncReminders',
}

type SyncToggles = {
  syncFinance: boolean
  syncHabits: boolean
  syncJournals: boolean
  syncReminders: boolean
}

async function fetchRow(tableName: string, rowId: string): Promise<Record<string, unknown> | null> {
  const db = await getDb()
  return db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM ${tableName} WHERE id = ?`,
    [rowId]
  )
}

async function markSyncedAt(tableName: string, rowId: string): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    `UPDATE ${tableName} SET synced_at = ? WHERE id = ?`,
    [nowIso(), rowId]
  )
}

let draining = false

export async function drainQueue(): Promise<void> {
  if (!supabase) return
  if (draining) return
  draining = true

  try {
    const session = useAuthStore.getState().session
    if (!session) return

    const userId = session.user.id
    const settings = useSettingsStore.getState() as SyncToggles & Record<string, unknown>
    const pending = await syncQueue.getPending(50)

    for (const item of pending) {
      const toggleKey = TABLE_MODULE[item.table_name]
      // Skip if module sync is disabled in settings
      if (toggleKey && settings[toggleKey] === false) continue

      try {
        if (item.operation === 'upsert') {
          const row = await fetchRow(item.table_name, item.row_id)
          if (!row) {
            // Row was hard-deleted locally; nothing to push
            await syncQueue.markSynced(item.id)
            continue
          }
          const payload = { ...row, user_id: userId }
          const { error } = await supabase.from(item.table_name).upsert(payload, { onConflict: 'id' })
          if (error) throw error
          await markSyncedAt(item.table_name, item.row_id)
        } else if (item.operation === 'wipe') {
          const { error } = await supabase.from(item.table_name).delete().eq('user_id', userId)
          if (error) throw error
        }
        await syncQueue.markSynced(item.id)
        logger.info(MODULE, 'synced', { table: item.table_name, op: item.operation, row: item.row_id })
      } catch (e) {
        logger.warn(MODULE, 'item failed', { item, error: String(e) })
        await syncQueue.markFailed(item.id, String(e))
      }
    }
  } catch (e) {
    logger.error(MODULE, 'drainQueue failed', { error: String(e) })
  } finally {
    draining = false
  }
}

/**
 * Call once after auth + migrations are ready.
 * Returns an unsubscribe function for cleanup.
 */
export function startSyncWorker(): () => void {
  // Drain immediately (handles rows written while offline)
  void drainQueue()

  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') void drainQueue()
  })

  return () => sub.remove()
}
