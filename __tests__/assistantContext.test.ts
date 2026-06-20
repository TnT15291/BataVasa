import { buildAssistantContext, buildAssistantSystemPrompt } from '../services/ai/assistantContext'
import { useSettingsStore } from '../store/settingsStore'

describe('assistant context', () => {
  beforeEach(() => {
    useSettingsStore.setState({ language: 'en', currency: 'USD' })
  })

  it('summarizes user data across modules for assistant answers', () => {
    const ctx = buildAssistantContext({
      now: new Date('2026-06-20T12:00:00.000Z'),
      categories: [
        { id: 'food', name: 'Food', kind: 'discretionary' },
        { id: 'salary', name: 'Salary', kind: 'income' },
      ] as any,
      transactions: [
        { id: 't1', amount_cents: -5000, currency: 'USD', category_id: 'food', merchant: 'Lunch place', note: null, occurred_at: '2026-06-19T12:00:00.000Z', needs_review: 1, deleted_at: null },
        { id: 't2', amount_cents: 200000, currency: 'USD', category_id: 'salary', merchant: 'Company', note: null, occurred_at: '2026-06-18T09:00:00.000Z', needs_review: 0, deleted_at: null },
      ] as any,
      habits: [
        { id: 'h1', name: 'Walk', target_per_period: 1, todayCount: 0, dueToday: true, streak: 8, deleted_at: null },
      ] as any,
      journals: [
        { id: 'j1', content: 'Felt focused after walking before work.', mood: 4, is_important: 1, tags: 'health,work', occurred_at: '2026-06-19T21:00:00.000Z', deleted_at: null },
      ] as any,
      reminders: [
        { id: 'r1', title: 'Pay rent', remind_at: '2026-06-20T09:00:00.000Z', advance_minutes: 0, priority: 'high', is_inbox: 0, completed: 0, deleted_at: null },
        { id: 'r2', title: 'Plan Sunday', remind_at: '2026-06-21T09:00:00.000Z', advance_minutes: 0, priority: 'medium', is_inbox: 0, completed: 0, deleted_at: null },
      ] as any,
      goals: [
        { title: 'Save emergency fund', status: 'active', deleted_at: null, progress: { percent: 30, label: '$300 / $1,000', sourceLabel: 'Savings' } },
      ] as any,
    })

    expect(ctx).toContain('FINANCE:')
    expect(ctx).toContain('Food: $50')
    expect(ctx).toContain('Needs review: Lunch place ($50)')
    expect(ctx).toContain('TASKS: open 2, today 1, overdue 1')
    expect(ctx).toContain('HABITS: active 1, due today 1, done today 0')
    expect(ctx).toContain('JOURNALS: 7d entries 1')
    expect(ctx).toContain('health:1')
    expect(ctx).toContain('GOALS: active 1')
    expect(ctx).toContain('Save emergency fund: 30%')
  })

  it('adds grounding rules to the assistant prompt', () => {
    const prompt = buildAssistantSystemPrompt('FINANCE: no data')

    expect(prompt).toContain('Reply in English ONLY')
    expect(prompt).toContain('Use the user\'s data context below as ground truth')
    expect(prompt).toContain('Do not invent records')
    expect(prompt).toContain('FINANCE: no data')
  })
})
