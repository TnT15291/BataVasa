import { formatLongTermSummary, type YearRollup } from '../services/ai/longTermContext'
import { useSettingsStore } from '../store/settingsStore'

function rollup(partial: Partial<YearRollup> & { year: number }): YearRollup {
  return {
    income: 0,
    expense: 0,
    topCategory: null,
    habitDone: 0,
    habitSkipped: 0,
    habitCount: 0,
    journalEntries: 0,
    journalAvgMood: null,
    journalImportant: 0,
    tasksTotal: 0,
    tasksCompleted: 0,
    ...partial,
  }
}

const NOW = new Date('2026-06-20T12:00:00.000Z')

describe('long-term summary formatter', () => {
  beforeEach(() => {
    useSettingsStore.setState({ language: 'en', currency: 'USD', hideJournals: false })
  })

  it('returns empty string when there are no years with data', () => {
    expect(formatLongTermSummary([], 'USD', NOW)).toBe('')
    expect(formatLongTermSummary([rollup({ year: 2025 })], 'USD', NOW)).toBe('')
  })

  it('marks the current year as YTD and sorts years newest-first', () => {
    const out = formatLongTermSummary(
      [
        rollup({ year: 2025, expense: 950000 }),
        rollup({ year: 2026, expense: 900000 }),
      ],
      'USD',
      NOW
    )
    expect(out).toContain('LONG-TERM')
    expect(out).toContain('2026 (YTD):')
    expect(out).toMatch(/2025: (?!.*YTD)/)
    expect(out.indexOf('2026')).toBeLessThan(out.indexOf('2025'))
  })

  it('formats each module rollup with concrete numbers', () => {
    const out = formatLongTermSummary(
      [
        rollup({
          year: 2026,
          income: 12000000,
          expense: 9000000,
          topCategory: 'Food',
          habitDone: 120,
          habitSkipped: 8,
          habitCount: 5,
          journalEntries: 80,
          journalAvgMood: 3.9,
          journalImportant: 4,
          tasksTotal: 60,
          tasksCompleted: 45,
        }),
      ],
      'USD',
      NOW
    )
    expect(out).toContain('top spend Food')
    expect(out).toContain('habits 120 done/8 skip across 5 habits')
    expect(out).toContain('avg mood 3.9/5')
    expect(out).toContain('4 important')
    expect(out).toContain('tasks 45/60 done (75%)')
  })

  it('omits skip and shows none for empty modules', () => {
    const out = formatLongTermSummary(
      [rollup({ year: 2024, habitDone: 90, habitCount: 4 })],
      'USD',
      NOW
    )
    expect(out).toContain('habits 90 done across 4 habits')
    expect(out).not.toContain('skip')
    expect(out).toContain('journals none')
    expect(out).toContain('tasks none')
  })

  it('masks long-term journal mood details when journals are hidden', () => {
    useSettingsStore.setState({ hideJournals: true })

    const out = formatLongTermSummary(
      [rollup({ year: 2026, journalEntries: 80, journalAvgMood: 3.9, journalImportant: 4 })],
      'USD',
      NOW
    )

    expect(out).toContain('journals 80 entries (privacy enabled)')
    expect(out).not.toContain('avg mood')
    expect(out).not.toContain('important')
  })
})
