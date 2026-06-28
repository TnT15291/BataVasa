import { buildWeeklyLifeReviewSnapshot, weeklyLifeReviewSummary } from '../services/ai/weeklyLifeReview'
import { useSettingsStore } from '../store/settingsStore'

describe('weekly life review', () => {
  beforeEach(() => {
    useSettingsStore.setState({ hideJournals: false, language: 'en', currency: 'USD' })
  })

  it('builds deterministic weekly metrics across modules', () => {
    const snapshot = buildWeeklyLifeReviewSnapshot({
      now: new Date('2026-06-19T12:00:00.000Z'),
      currency: 'USD',
      amountInCurrency: (amount) => amount,
      categories: [
        { id: 'food', name: 'Food', kind: 'discretionary' },
        { id: 'salary', name: 'Salary', kind: 'income' },
      ] as any,
      transactions: [
        { id: 't1', amount_cents: -5000, currency: 'USD', category_id: 'food', occurred_at: '2026-06-16T10:00:00.000Z', needs_review: 1, deleted_at: null },
        { id: 't2', amount_cents: 20000, currency: 'USD', category_id: 'salary', occurred_at: '2026-06-17T10:00:00.000Z', needs_review: 0, deleted_at: null },
        { id: 't3', amount_cents: -2500, currency: 'USD', category_id: 'food', occurred_at: '2026-06-10T10:00:00.000Z', needs_review: 0, deleted_at: null },
      ] as any,
      habits: [
        { id: 'h1', name: 'Walk', streak: 8, deleted_at: null },
      ] as any,
      habitLogs: [
        { habit_id: 'h1', occurred_at: '2026-06-16T08:00:00.000Z', skipped: 0, deleted_at: null },
        { habit_id: 'h1', occurred_at: '2026-06-17T08:00:00.000Z', skipped: 1, deleted_at: null },
      ] as any,
      journals: [
        { occurred_at: '2026-06-18T21:00:00.000Z', mood: 4, is_important: 1, tags: 'work,health', deleted_at: null },
        { occurred_at: '2026-06-19T21:00:00.000Z', mood: 2, is_important: 0, tags: 'work', deleted_at: null },
      ] as any,
      reminders: [
        { remind_at: '2026-06-16T09:00:00.000Z', advance_minutes: 0, completed: 1, priority: 'medium', is_inbox: 0, deleted_at: null },
        { remind_at: '2026-06-18T09:00:00.000Z', advance_minutes: 0, completed: 0, priority: 'high', is_inbox: 0, deleted_at: null },
      ] as any,
      goals: [
        { title: 'Spend less', status: 'active', deleted_at: null, progress: { percent: 75, label: '$75 / $100', sourceLabel: 'Food', note: '1 foreign-currency group was not counted.' } },
        { title: 'Move more', status: 'active', deleted_at: null, progress: { percent: 25, label: '25% / 80%', sourceLabel: 'Walk' } },
        { title: 'Finish launch prep', status: 'done', deleted_at: null, progress: { percent: 100, label: '10 / 10', sourceLabel: 'Tasks' } },
        { title: 'Learn piano', status: 'paused', deleted_at: null, progress: { percent: 30, label: '3 / 10', sourceLabel: 'Practice' } },
      ] as any,
    })

    expect(snapshot.weekStart).toBe('2026-06-15')
    expect(snapshot.finance.expense).toBe(5000)
    expect(snapshot.finance.previousExpense).toBe(2500)
    expect(snapshot.finance.expenseDeltaPercent).toBe(100)
    expect(snapshot.finance.topCategories[0]).toEqual({ name: 'Food', amount: 5000 })
    expect(snapshot.finance.reviewCount).toBe(1)
    expect(snapshot.habits.completions).toBe(1)
    expect(snapshot.habits.skips).toBe(1)
    expect(snapshot.journals.avgMood).toBe(3)
    expect(snapshot.reminders.completionRate).toBe(50)
    expect(snapshot.goals.onTrack).toBe(1)
    expect(snapshot.goals.needsAttention).toBe(1)
    expect(snapshot.goals.top[1]?.note).toBe('1 foreign-currency group was not counted.')
    expect(snapshot.goals.done).toBe(1)
    expect(snapshot.goals.paused).toBe(1)
    expect(weeklyLifeReviewSummary(snapshot, 'USD')).toContain('1 completed, 1 paused')
  })

  it('serializes a compact AI summary', () => {
    const snapshot = buildWeeklyLifeReviewSnapshot({
      now: new Date('2026-06-19T12:00:00.000Z'),
      currency: 'USD',
      transactions: [],
      categories: [],
      habits: [],
      habitLogs: [],
      journals: [],
      reminders: [],
      goals: [],
    })

    expect(weeklyLifeReviewSummary(snapshot, 'USD')).toContain('WEEK: 2026-06-15 - 2026-06-21')
    expect(weeklyLifeReviewSummary(snapshot, 'USD')).toContain('No active goals')
  })

  it('includes goal progress notes in the AI summary', () => {
    const snapshot = buildWeeklyLifeReviewSnapshot({
      now: new Date('2026-06-19T12:00:00.000Z'),
      currency: 'USD',
      transactions: [],
      categories: [],
      habits: [],
      habitLogs: [],
      journals: [],
      reminders: [],
      goals: [
        { title: 'Save GPU fund', status: 'active', deleted_at: null, progress: { percent: 50, label: '$500 / $1,000', sourceLabel: 'GPU Fund', note: '1 foreign-currency group was not counted.' } },
      ] as any,
    })

    expect(weeklyLifeReviewSummary(snapshot, 'USD')).toContain('note: 1 foreign-currency group was not counted.')
  })

  it('masks journal mood and tags when hidden journal privacy is enabled', () => {
    useSettingsStore.setState({ hideJournals: true })
    const snapshot = buildWeeklyLifeReviewSnapshot({
      now: new Date('2026-06-19T12:00:00.000Z'),
      currency: 'USD',
      amountInCurrency: (amount) => amount,
      categories: [],
      transactions: [],
      habits: [],
      habitLogs: [],
      journals: [
        { occurred_at: '2026-06-18T21:00:00.000Z', mood: 5, is_important: 1, tags: 'secret_tag', deleted_at: null },
      ] as any,
      reminders: [],
      goals: [],
    })

    expect(snapshot.journals.entries).toBe(1)
    expect(snapshot.journals.avgMood).toBeNull()
    expect(snapshot.journals.important).toBe(0)
    expect(snapshot.journals.tags).toEqual([])
    const summary = weeklyLifeReviewSummary(snapshot, 'USD')
    expect(summary).toContain('Journal privacy is enabled')
    expect(summary).not.toContain('secret_tag')
    expect(summary).not.toContain('avg mood 5')
  })
})
