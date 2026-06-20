import { formatWeeklyTeaser, type WeeklyTeaserMetrics } from '../services/weeklyTeaser'
import { useSettingsStore } from '../store/settingsStore'

function metrics(partial: Partial<WeeklyTeaserMetrics>): WeeklyTeaserMetrics {
  return {
    expense: 0,
    expenseDeltaPercent: null,
    habitsDone: 0,
    journalAvgMood: null,
    overdueTasks: 0,
    ...partial,
  }
}

describe('weekly teaser formatter', () => {
  beforeEach(() => {
    useSettingsStore.setState({ language: 'en', currency: 'USD' })
  })

  it('returns empty when nothing is worth showing', () => {
    expect(formatWeeklyTeaser(metrics({}), 'USD')).toBe('')
  })

  it('renders all signals with icons and numbers', () => {
    const out = formatWeeklyTeaser(
      metrics({ expense: 210000, expenseDeltaPercent: -12, habitsDone: 5, journalAvgMood: 3.9, overdueTasks: 2 }),
      'USD'
    )
    expect(out).toContain('💸')
    expect(out).toContain('(-12%)')
    expect(out).toContain('✅ 5')
    expect(out).toContain('🙂 3.9/5')
    expect(out).toContain('⏰ 2')
  })

  it('shows a + sign for higher spending and omits the delta when no baseline', () => {
    expect(formatWeeklyTeaser(metrics({ expense: 100000, expenseDeltaPercent: 8 }), 'USD')).toContain('(+8%)')
    expect(formatWeeklyTeaser(metrics({ expense: 100000, expenseDeltaPercent: null }), 'USD')).not.toContain('%')
  })

  it('omits empty signals', () => {
    const out = formatWeeklyTeaser(metrics({ habitsDone: 3 }), 'USD')
    expect(out).toBe('✅ 3')
    expect(out).not.toContain('💸')
    expect(out).not.toContain('🙂')
    expect(out).not.toContain('⏰')
  })
})
