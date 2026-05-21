/**
 * B1 & B2 Integration Tests
 * Validates Supabase auth and cloud sync flows.
 *
 * Run with: npm test -- b1b2.test.ts
 */

import { validateAuth, validateSync, validateBoth } from '@services/b1b2-validate'

describe('B1: Supabase Auth Validation', () => {
  it('should detect Supabase configuration', async () => {
    const result = await validateAuth()
    console.log('Auth config:', result.configured)
    console.log('Auth msg:', result.configured_msg)
    // Note: Will fail if EXPO_PUBLIC_SUPABASE_URL/KEY not set, which is expected
    // for test env — this is informational.
  })

  it('should report session state', async () => {
    const result = await validateAuth()
    console.log('Has session:', result.has_session)
    console.log('Initialized:', result.initialized)
    // Expect: initialized = true (after app boot)
    // Expect: has_session = true or false depending on user login state
  })

  it('should show errors if auth fails', async () => {
    const result = await validateAuth()
    if (result.error) {
      console.warn('Auth error detected:', result.error)
    }
  })
})

describe('B2: Cloud Sync Validation', () => {
  it('should report sync queue status', async () => {
    const result = await validateSync()
    console.log('User authenticated:', result.user_authenticated)
    console.log('Sync queue pending:', result.sync_queue_pending_count)
    console.log('Sync toggles:', {
      finance: result.sync_finance_enabled,
      habits: result.sync_habits_enabled,
      journals: result.sync_journals_enabled,
      reminders: result.sync_reminders_enabled,
    })
  })

  it('should list pending items', async () => {
    const result = await validateSync()
    if (result.pending_items && result.pending_items.length > 0) {
      console.log('Pending items:')
      result.pending_items.forEach((item) => {
        console.log(`  - ${item.table_name}/${item.row_id} [${item.operation}]`)
      })
    } else {
      console.log('No pending items')
    }
  })
})

describe('B1 & B2: Combined Status', () => {
  it('should provide overall status', async () => {
    const result = await validateBoth()
    console.log('Summary:', result.summary)
    console.log('Full result:', result)
  })
})
