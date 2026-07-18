const mockDb = { getAllAsync: jest.fn(), getFirstAsync: jest.fn() }
const mockSettings = { hideJournals: false }
jest.mock('../database/core/db', () => ({ getDb: jest.fn(() => Promise.resolve(mockDb)) }))
jest.mock('../services/identity', () => ({ getCurrentUserId: () => 'user-1' }))
jest.mock('../store/settingsStore', () => ({ useSettingsStore: { getState: () => mockSettings } }))
jest.mock('../services/i18n', () => ({ getTranslations: () => ({
  cadence_daily: 'Daily', cadence_weekdays: 'Weekdays', cadence_weekly: 'Weekly', cadence_monthly: 'Monthly', cadence_custom: 'Custom',
  tag_work: 'Work', tag_family: 'Family', tag_health: 'Health', tag_money: 'Money', tag_sleep: 'Sleep',
  tag_exercise: 'Exercise', tag_stress: 'Stress', tag_food: 'Food', tag_travel: 'Travel', tag_social: 'Social',
  hide_journals_locked_count: '{{count}} private journals', hide_journals_locked: 'Journals hidden',
}) }))

import { searchAll } from '../services/search'

beforeEach(() => { jest.clearAllMocks(); mockSettings.hideJournals = false })

describe('global search', () => {
  it('returns nothing for queries shorter than two characters', async () => {
    await expect(searchAll(' a ')).resolves.toEqual([])
    expect(mockDb.getAllAsync).not.toHaveBeenCalled()
  })

  it('searches all modules, localizes domain values, and sorts newest first', async () => {
    mockDb.getAllAsync
      .mockResolvedValueOnce([{ id: 'f1', title: 'Cafe', subtitle: 'Food', occurred_at: '2026-01-05' }])
      .mockResolvedValueOnce([{ id: 'r1', title: 'Call', subtitle: '', occurred_at: '2026-01-04' }])
      .mockResolvedValueOnce([{ id: 'h1', title: 'Run', subtitle: 'daily', occurred_at: '2026-01-03' }])
      .mockResolvedValueOnce([{ id: 'j1', title: 'Good day', subtitle: 'work,health', occurred_at: '2026-01-02' }])
      .mockResolvedValueOnce([{ id: 'g1', title: 'Save', subtitle: 'active', occurred_at: '2026-01-01' }])

    const results = await searchAll('test', 4)

    expect(results.map((result) => result.module)).toEqual(['finance', 'reminders', 'habits', 'journals', 'goals'])
    expect(results.find((result) => result.module === 'habits')?.subtitle).toBe('Daily')
    expect(results.find((result) => result.module === 'journals')?.subtitle).toBe('Work, Health')
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('finance_transaction'), ['user-1', '%test%', '%test%', '%test%', '%test%', 4])
  })

  it('does not expose journal content when journals are hidden', async () => {
    mockSettings.hideJournals = true
    mockDb.getAllAsync.mockResolvedValue([])
    mockDb.getFirstAsync.mockResolvedValue({ count: 3 })

    const results = await searchAll('private')

    expect(results.find((result) => result.module === 'journals')).toMatchObject({ id: 'journals-hidden', title: '3 private journals' })
    expect(mockDb.getAllAsync.mock.calls.some(([sql]) => String(sql).includes('FROM journal'))).toBe(false)
  })
})
