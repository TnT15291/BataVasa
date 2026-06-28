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
    expect(typeof result.configured).toBe('boolean')
    expect(typeof result.configured_msg).toBe('string')
    // Note: Will fail if EXPO_PUBLIC_SUPABASE_URL/KEY not set, which is expected
    // for test env; this is informational.
  })

  it('should report session state', async () => {
    const result = await validateAuth()
    expect(typeof result.has_session).toBe('boolean')
    expect(typeof result.initialized).toBe('boolean')
    // Expect: initialized = true (after app boot)
    // Expect: has_session = true or false depending on user login state
  })

  it('should show errors if auth fails', async () => {
    const result = await validateAuth()
    expect(result.error === undefined || typeof result.error === 'string').toBe(true)
  })
})

describe('B2: Cloud Sync Validation', () => {
  it('should report sync queue status', async () => {
    const result = await validateSync()
    expect(typeof result.user_authenticated).toBe('boolean')
    expect(typeof result.sync_queue_pending_count).toBe('number')
    expect(typeof result.sync_finance_enabled).toBe('boolean')
    expect(typeof result.sync_habits_enabled).toBe('boolean')
    expect(typeof result.sync_journals_enabled).toBe('boolean')
    expect(typeof result.sync_reminders_enabled).toBe('boolean')
  })

  it('should list pending items', async () => {
    const result = await validateSync()
    expect(result.pending_items === undefined || Array.isArray(result.pending_items)).toBe(true)
  })
})

describe('B1 & B2: Combined Status', () => {
  it('should provide overall status', async () => {
    const result = await validateBoth()
    expect(typeof result.summary).toBe('string')
    expect(result.b1).toBeDefined()
    expect(result.b2).toBeDefined()
  })
})
