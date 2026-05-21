/**
 * B1 & B2 Runtime Validation Helpers
 * Use these functions to verify Supabase auth and cloud sync are working.
 * Call from DevTools, Sentry context, or manually in app for debugging.
 *
 * Example (in a test env or console):
 *   import { validateAuth, validateSync } from '@services/b1b2-validate'
 *   const authResult = await validateAuth()
 *   console.log(authResult)
 */

import { supabase, isSupabaseConfigured } from './supabase'

declare const require: ((id: string) => any) | undefined

export type B1ValidationResult = {
  configured: boolean
  configured_msg: string
  has_session: boolean
  session_user?: string
  session_token_preview?: string
  initialized: boolean
  error?: string
}

export type B2ValidationResult = {
  configured: boolean
  user_authenticated: boolean
  sync_queue_pending_count: number
  sync_finance_enabled: boolean
  sync_habits_enabled: boolean
  sync_journals_enabled: boolean
  sync_reminders_enabled: boolean
  pending_items?: Array<{
    id: string
    table_name: string
    operation: string
    row_id: string
    synced_at: string | null
  }>
  error?: string
}

/**
 * B1: Verify Supabase auth config and session state
 */
export async function validateAuth(): Promise<B1ValidationResult> {
  const result: B1ValidationResult = {
    configured: isSupabaseConfigured,
    configured_msg: isSupabaseConfigured
      ? 'Supabase env vars present'
      : 'EXPO_PUBLIC_SUPABASE_URL or ANON_KEY missing',
    has_session: false,
    initialized: false,
  }

  if (!isSupabaseConfigured || !supabase) {
    return result
  }

  try {
    const { useAuthStore } = require!('@store/authStore')
    const authState = useAuthStore.getState()
    result.initialized = authState.initialized

    if (authState.session) {
      result.has_session = true
      result.session_user = authState.session.user?.email
      result.session_token_preview = authState.session.access_token
        ? authState.session.access_token.slice(0, 20) + '...'
        : undefined
    }

    // Try to get session from Supabase directly
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      result.error = `getSession error: ${error.message}`
    } else if (data.session) {
      result.has_session = true
      result.session_user = data.session.user?.email
      result.session_token_preview = data.session.access_token.slice(0, 20) + '...'
    }
  } catch (e) {
    result.error = `Exception: ${String(e)}`
  }

  return result
}

/**
 * B2: Verify sync queue and toggle state
 */
export async function validateSync(): Promise<B2ValidationResult> {
  const result: B2ValidationResult = {
    configured: isSupabaseConfigured,
    user_authenticated: false,
    sync_queue_pending_count: 0,
    sync_finance_enabled: true,
    sync_habits_enabled: true,
    sync_journals_enabled: true,
    sync_reminders_enabled: true,
  }

  if (!isSupabaseConfigured) {
    result.error = 'Supabase not configured'
    return result
  }

  try {
    // Check auth
    const { useAuthStore } = require!('@store/authStore')
    const { useSettingsStore } = require!('@store/settingsStore')
    const { getDb } = require!('@db/core/db')
    const authState = useAuthStore.getState()
    result.user_authenticated = !!authState.session

    // Check settings toggles
    const settings = useSettingsStore.getState()
    result.sync_finance_enabled = settings.syncFinance
    result.sync_habits_enabled = settings.syncHabits
    result.sync_journals_enabled = settings.syncJournals
    result.sync_reminders_enabled = settings.syncReminders

    // Get pending queue items
    const db = await getDb() as {
      getAllAsync<T>(query: string, params?: unknown[]): Promise<T[]>
    }
    const pending = await db.getAllAsync<{
      id: string
      table_name: string
      operation: string
      row_id: string
      synced_at: string | null
    }>('SELECT id, table_name, operation, row_id, synced_at FROM sync_queue WHERE synced_at IS NULL LIMIT 20')

    result.sync_queue_pending_count = pending?.length ?? 0
    result.pending_items = pending
  } catch (e) {
    result.error = `Exception: ${String(e)}`
  }

  return result
}

/**
 * B1 & B2 combined status
 */
export async function validateBoth(): Promise<{
  b1: B1ValidationResult
  b2: B2ValidationResult
  summary: string
}> {
  const b1 = await validateAuth()
  const b2 = await validateSync()

  let summary = ''
  if (!b1.configured) {
    summary = '❌ Supabase not configured. Set env vars in .env.local'
  } else if (!b1.has_session) {
    summary = '⚠️  No session. User needs to sign in.'
  } else if (!b2.user_authenticated) {
    summary = '⚠️  Authenticated but sync not ready.'
  } else if (b2.sync_queue_pending_count === 0) {
    summary = '✅ Fully ready. No pending sync items.'
  } else {
    summary = `✅ Authenticated & sync ready. ${b2.sync_queue_pending_count} items pending sync.`
  }

  return { b1, b2, summary }
}

/**
 * Log all validation results to console (for debugging)
 */
export async function logValidation(): Promise<void> {
  const result = await validateBoth()
  console.group('B1 & B2 Validation')
  console.log('Summary:', result.summary)
  console.log('B1 (Auth):', result.b1)
  console.log('B2 (Sync):', result.b2)
  if (result.b2.pending_items) {
    console.table(result.b2.pending_items)
  }
  console.groupEnd()
}
