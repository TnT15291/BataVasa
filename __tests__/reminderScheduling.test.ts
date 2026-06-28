// Pure date-math for the two new reminder features:
//  - planItemReminderSchedule: bill due_day → next reminder fire time.
//  - computeAnniversaryPlan / formatAnniversaryBody: journal "on this day".
// Heavy module deps are mocked so only the deterministic logic is exercised.

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }))
jest.mock('expo-notifications', () => ({}))
jest.mock('../database/core/db', () => ({ nowIso: () => '2026-01-01T00:00:00.000Z', getDb: jest.fn() }))
jest.mock('../database/finance/queries', () => ({}))
jest.mock('../database/sync/queue', () => ({ enqueue: jest.fn() }))
jest.mock('../database/journals/queries', () => ({ listJournals: jest.fn() }))
jest.mock('../services/uuid', () => ({ uuid: () => 'id-1' }))
jest.mock('../services/identity', () => ({ getCurrentUserId: () => 'user-1' }))
jest.mock('../services/analytics', () => ({ track: jest.fn() }))
jest.mock('../services/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))
jest.mock('../services/fx', () => ({ convertMinorAmount: jest.fn() }))
jest.mock('../services/notifications', () => ({ requestNotificationPermission: jest.fn() }))
jest.mock('../services/i18n', () => ({ getTranslations: jest.fn() }))
jest.mock('../store/settingsStore', () => ({ useSettingsStore: { getState: () => ({}) } }))
jest.mock('../features/reminders/services', () => ({
  createReminder: jest.fn(),
  updateReminder: jest.fn(),
  deleteReminder: jest.fn(),
}))

import { planItemReminderSchedule } from '../features/finance/services'
import { computeAnniversaryPlan, formatAnniversaryBody } from '../services/anniversaryNotifications'

// Build an ISO string whose LOCAL calendar day is the given y/m/d, so the
// assertions hold regardless of the test runner's timezone.
const isoLocal = (y: number, m0: number, d: number, h = 10) => new Date(y, m0, d, h).toISOString()

describe('planItemReminderSchedule (bill due_day → reminder)', () => {
  it('monthly: due day still ahead this month fires this month at 09:00', () => {
    const now = new Date(2026, 5, 10, 8) // Jun 10 2026, 08:00 local
    const r = planItemReminderSchedule(15, 'monthly', null, now)
    expect(r.recurrence).toBe('monthly')
    expect(r.remind_at).toBe(new Date(2026, 5, 15, 9, 0, 0, 0).toISOString())
  })

  it('monthly: due day already passed rolls to next month', () => {
    const now = new Date(2026, 5, 20, 10) // Jun 20, past the 15th
    const r = planItemReminderSchedule(15, 'monthly', null, now)
    expect(r.remind_at).toBe(new Date(2026, 6, 15, 9, 0, 0, 0).toISOString())
  })

  it('monthly: clamps day 31 to the next month last day (Feb non-leap)', () => {
    const now = new Date(2026, 0, 31, 12) // Jan 31, past 09:00 → next month
    const r = planItemReminderSchedule(31, 'monthly', null, now)
    expect(r.remind_at).toBe(new Date(2026, 1, 28, 9, 0, 0, 0).toISOString())
  })

  it('once: fires on the applies_month due day and does not recur', () => {
    const now = new Date(2026, 5, 10, 8)
    const r = planItemReminderSchedule(10, 'once', '2026-09', now)
    expect(r.recurrence).toBe('none')
    expect(r.remind_at).toBe(new Date(2026, 8, 10, 9, 0, 0, 0).toISOString())
  })

  it('once: clamps day 31 to the applies_month last day', () => {
    const now = new Date(2026, 0, 1, 8)
    const r = planItemReminderSchedule(31, 'once', '2026-02', now)
    expect(r.remind_at).toBe(new Date(2026, 1, 28, 9, 0, 0, 0).toISOString())
  })
})

describe('computeAnniversaryPlan (journal "on this day")', () => {
  const now = new Date(2026, 5, 25, 8) // Jun 25 2026, 08:00 local

  it('includes an entry whose 1-year anniversary is today, with years=1', () => {
    const plan = computeAnniversaryPlan([{ id: 'a', occurred_at: isoLocal(2025, 5, 25) }], now)
    expect(plan).toHaveLength(1)
    expect(plan[0]).toMatchObject({ journalId: 'a', years: 1 })
    expect(plan[0]!.fireAt.toISOString()).toBe(new Date(2026, 5, 25, 9, 0, 0, 0).toISOString())
  })

  it('reports multi-year anniversaries (2 years)', () => {
    const plan = computeAnniversaryPlan([{ id: 'b', occurred_at: isoLocal(2024, 5, 26) }], now)
    expect(plan[0]).toMatchObject({ journalId: 'b', years: 2 })
  })

  it('excludes anniversaries beyond the horizon window', () => {
    // Anniversary ~5 months away → outside the default 35-day horizon.
    const plan = computeAnniversaryPlan([{ id: 'c', occurred_at: isoLocal(2024, 10, 25) }], now)
    expect(plan).toHaveLength(0)
  })

  it('excludes sub-1-year entries (no same-year "0-year" nudge)', () => {
    // Occurred this year, already passed → next anniversary is ~11 months out.
    const plan = computeAnniversaryPlan([{ id: 'd', occurred_at: isoLocal(2026, 5, 1) }], now)
    expect(plan).toHaveLength(0)
  })

  it('sorts soonest first and caps the count', () => {
    const entries = [
      { id: 'far', occurred_at: isoLocal(2025, 6, 20) },   // Jul 20 — later
      { id: 'near', occurred_at: isoLocal(2025, 5, 26) },  // Jun 26 — sooner
    ]
    const plan = computeAnniversaryPlan(entries, now, 60, 1)
    expect(plan).toHaveLength(1)
    expect(plan[0]!.journalId).toBe('near')
  })

  it('skips entries with an unparseable date', () => {
    const plan = computeAnniversaryPlan([{ id: 'x', occurred_at: 'not-a-date' }], now)
    expect(plan).toHaveLength(0)
  })
})

describe('formatAnniversaryBody', () => {
  const t = {
    anniversary_notif_body_one: 'A year ago today…',
    anniversary_notif_body_many: '{{years}} years ago today…',
  } as any

  it('uses the singular body for 1 year', () => {
    expect(formatAnniversaryBody(t, 1)).toBe('A year ago today…')
  })

  it('interpolates the year count for multi-year', () => {
    expect(formatAnniversaryBody(t, 3)).toBe('3 years ago today…')
  })
})
