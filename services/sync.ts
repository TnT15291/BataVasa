import { AppState } from 'react-native'
import { supabase } from './supabase'
import { logger } from './logger'
import { getDb, nowIso } from '@db/core/db'
import * as syncQueue from '@db/sync/queue'
import { useAuthStore } from '@store/authStore'
import { useSettingsStore } from '@store/settingsStore'
import { useFinanceStore } from '@store/financeStore'
import { useHabitsStore } from '@store/habitsStore'
import { useJournalsStore } from '@store/journalsStore'
import { useRemindersStore } from '@store/remindersStore'

const MODULE = 'sync'

// Maps each table to its settingsStore sync-toggle key.
const TABLE_MODULE: Record<string, keyof SyncToggles> = {
  finance_category:   'syncFinance',
  finance_transaction: 'syncFinance',
  finance_rule:       'syncFinance',
  finance_plan_item:  'syncFinance',
  finance_debt:       'syncFinance',
  habit:              'syncHabits',
  habit_log:          'syncHabits',
  journal:            'syncJournals',
  reminder:           'syncReminders',
}

const SYNC_TABLES = Object.keys(TABLE_MODULE)

type SyncToggles = {
  syncFinance: boolean
  syncHabits: boolean
  syncJournals: boolean
  syncReminders: boolean
}

function sanitizePayloadForRemote(tableName: string, row: Record<string, unknown>): Record<string, unknown> {
  const payload = { ...row }
  if (tableName === 'finance_transaction') {
    delete payload.fund_id
  }
  return payload
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

async function pushVisibleFinanceCategories(userId: string): Promise<void> {
  if (!supabase) return

  const db = await getDb()
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM finance_category
     WHERE deleted_at IS NULL
       AND (user_id IS NULL OR user_id = ?)`,
    [userId]
  )
  if (rows.length === 0) return

  const now = nowIso()
  const payloads = rows.map((row) => ({
    ...row,
    user_id: userId,
    synced_at: now,
  }))
  const { error } = await supabase.from('finance_category').upsert(payloads, { onConflict: 'id' })
  if (error) throw error
}

async function getLocalColumns(tableName: string): Promise<string[]> {
  const db = await getDb()
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName})`)
  return rows.map((row) => row.name)
}

async function getLocalUpdatedAt(tableName: string, rowId: string): Promise<string | null> {
  const db = await getDb()
  const row = await db.getFirstAsync<{ updated_at: string | null }>(
    `SELECT updated_at FROM ${tableName} WHERE id = ?`,
    [rowId]
  )
  return row?.updated_at ?? null
}

async function upsertPulledRow(tableName: string, row: Record<string, unknown>): Promise<boolean> {
  if (!row.id || typeof row.id !== 'string') return false

  const localUpdatedAt = await getLocalUpdatedAt(tableName, row.id)
  const remoteUpdatedAt = typeof row.updated_at === 'string' ? row.updated_at : null
  if (localUpdatedAt && remoteUpdatedAt && localUpdatedAt > remoteUpdatedAt) {
    return false
  }

  const columns = await getLocalColumns(tableName)
  const now = nowIso()
  const payload: Record<string, unknown> = { ...row, synced_at: now }
  const writeColumns = columns.filter((col) => Object.prototype.hasOwnProperty.call(payload, col))
  if (!writeColumns.includes('id')) return false

  const placeholders = writeColumns.map(() => '?').join(', ')
  const updateColumns = writeColumns.filter((col) => col !== 'id')
  const updates = updateColumns.map((col) => `${col} = excluded.${col}`).join(', ')
  const values = writeColumns.map((col) => payload[col] as string | number | null)
  const db = await getDb()

  await db.runAsync(
    `INSERT INTO ${tableName} (${writeColumns.join(', ')})
     VALUES (${placeholders})
     ON CONFLICT(id) DO UPDATE SET ${updates}
     WHERE ${tableName}.updated_at IS NULL
        OR excluded.updated_at IS NULL
        OR excluded.updated_at >= ${tableName}.updated_at`,
    values
  )
  return true
}

async function pullTable(tableName: string, userId: string): Promise<number> {
  if (!supabase) return 0
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: true })
    .limit(500)

  if (error) throw error
  let changed = 0
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    if (await upsertPulledRow(tableName, row)) changed += 1
  }
  return changed
}

async function enqueueUnsyncedLocalRows(settings: SyncToggles & Record<string, unknown>, userId: string): Promise<void> {
  const db = await getDb()
  for (const tableName of SYNC_TABLES) {
    const toggleKey = TABLE_MODULE[tableName]
    if (toggleKey && settings[toggleKey] === false) continue
    try {
      const rows = await db.getAllAsync<{ id: string }>(
        `SELECT id FROM ${tableName}
         WHERE synced_at IS NULL
           AND (user_id = ? OR user_id IS NULL)
         LIMIT 500`,
        [userId]
      )
      for (const row of rows) {
        if (row.id) await syncQueue.enqueue(tableName, row.id, 'upsert')
      }
    } catch (e) {
      logger.warn(MODULE, 'unsynced scan failed', { table: tableName, error: String(e) })
    }
  }
}

async function refreshLoadedStores(settings: SyncToggles): Promise<void> {
  const tasks: Array<Promise<void>> = []
  if (settings.syncFinance) {
    const finance = useFinanceStore.getState()
    tasks.push(finance.loadCategories(), finance.loadTransactions(), finance.loadPlanItems())
  }
  if (settings.syncHabits) tasks.push(useHabitsStore.getState().loadHabits())
  if (settings.syncJournals) tasks.push(useJournalsStore.getState().loadJournals())
  if (settings.syncReminders) tasks.push(useRemindersStore.getState().loadReminders())
  await Promise.allSettled(tasks)
}

export async function pullRemoteData(): Promise<void> {
  if (!supabase) return

  const session = useAuthStore.getState().session
  if (!session) return

  const settings = useSettingsStore.getState() as SyncToggles & Record<string, unknown>
  const userId = session.user.id
  let changed = 0

  for (const tableName of SYNC_TABLES) {
    const toggleKey = TABLE_MODULE[tableName]
    if (toggleKey && settings[toggleKey] === false) continue
    try {
      changed += await pullTable(tableName, userId)
    } catch (e) {
      logger.warn(MODULE, 'pull failed', { table: tableName, error: String(e) })
    }
  }

  if (changed > 0) {
    await refreshLoadedStores(settings)
    logger.info(MODULE, 'pulled remote rows', { count: changed })
  }
}

export async function drainQueue(): Promise<void> {
  if (!supabase) return
  if (draining) return
  draining = true

  try {
    const session = useAuthStore.getState().session
    if (!session) return

    const userId = session.user.id
    const settings = useSettingsStore.getState() as SyncToggles & Record<string, unknown>
    await syncQueue.purgeFailed()
    if (settings.syncFinance !== false) {
      try {
        await pushVisibleFinanceCategories(userId)
      } catch (e) {
        logger.warn(MODULE, 'finance category pre-sync failed', { error: String(e) })
      }
    }
    await enqueueUnsyncedLocalRows(settings, userId)
    const pending = await syncQueue.getPending(50)

    for (const item of pending) {
      const toggleKey = TABLE_MODULE[item.table_name]
      // Skip if module sync is disabled in settings
      if (toggleKey && settings[toggleKey] === false) continue

      try {
        if (!TABLE_MODULE[item.table_name]) {
          await syncQueue.markSynced(item.id)
          logger.info(MODULE, 'skipped retired sync table', { table: item.table_name, row: item.row_id })
          continue
        }
        if (item.operation === 'upsert') {
          const row = await fetchRow(item.table_name, item.row_id)
          if (!row) {
            // Row was hard-deleted locally; nothing to push
            await syncQueue.markSynced(item.id)
            continue
          }
          const payload = sanitizePayloadForRemote(item.table_name, { ...row, user_id: userId })
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

    await pullRemoteData()
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
