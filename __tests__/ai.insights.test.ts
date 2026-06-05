jest.mock('../services/ai/openai', () => ({
  chatCompletion: jest.fn(),
}))

jest.mock('../services/ai/aiLanguage', () => ({
  getAILanguage: jest.fn(() => 'Vietnamese'),
  getAICurrency: jest.fn(() => 'VND'),
  fmtAI: jest.fn((amount: number, currency: string) => `${amount} ${currency}`),
}))

import { chatCompletion } from '../services/ai/openai'
import { generateFinanceInsights } from '../services/ai/financeInsight'
import { generateHabitInsight } from '../services/ai/habitInsight'
import { generateJournalReflection } from '../services/ai/journalInsight'
import { generateCrossModuleInsights } from '../services/ai/crossModuleInsight'

const mockedChatCompletion = chatCompletion as jest.MockedFunction<typeof chatCompletion>

const baseTx = {
  id: 'tx-1',
  user_id: 'user-1',
  amount_cents: -125000,
  currency: 'VND',
  category_id: 'cat-food',
  merchant: 'Cafe',
  note: null,
  occurred_at: new Date().toISOString(),
  mood: 'happy',
  source: 'manual',
  needs_review: 0,
  review_reason: null,
  location_lat: null,
  location_lng: null,
  location_label: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
  synced_at: null,
}

const baseCategory = {
  id: 'cat-food',
  user_id: 'user-1',
  name: 'Food',
  icon: 'utensils',
  color: '#22C55E',
  kind: 'essential',
  parent_id: null,
  sort_order: 1,
  monthly_budget_cents: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
  synced_at: null,
}

const baseHabit = {
  id: 'habit-1',
  user_id: 'user-1',
  name: 'Walk',
  icon: 'activity',
  color: '#22C55E',
  cadence: 'daily',
  target_per_period: 1,
  sort_order: 1,
  archived_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
  synced_at: null,
}

const baseHabitLog = {
  id: 'log-1',
  habit_id: 'habit-1',
  occurred_at: new Date().toISOString(),
  count: 1,
  note: null,
  skipped: 0,
  created_at: new Date().toISOString(),
  deleted_at: null,
  synced_at: null,
}

const baseJournal = {
  id: 'journal-1',
  user_id: 'user-1',
  title: 'A good day',
  content: 'Felt focused after walking and spent less on snacks.',
  mood: 4,
  tags: 'focus,health',
  is_important: 0,
  occurred_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
  synced_at: null,
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('AI insight builders', () => {
  it('builds a finance prompt with category, merchant, mood, and trend context', async () => {
    mockedChatCompletion.mockResolvedValueOnce('finance insight')

    await expect(generateFinanceInsights([baseTx as any], [baseCategory as any], 'this week')).resolves.toBe('finance insight')

    const messages = mockedChatCompletion.mock.calls[0][0]
    expect(messages[0].content).toContain('Vietnamese ONLY')
    expect(messages[1].content).toContain('this week')
    expect(messages[1].content).toContain('OVERVIEW')
    expect(messages[1].content).toContain('TOP CATEGORIES')
    expect(messages[1].content).toContain('DAY-OF-WEEK')
    expect(messages[1].content).toContain('MOOD WHEN SPENDING')
  })

  it('rejects finance and cross-module insight generation without data', async () => {
    await expect(generateFinanceInsights([], [])).rejects.toThrow('NO_DATA')
    await expect(generateCrossModuleInsights({
      transactions: [],
      categories: [],
      habits: [],
      journals: [],
    })).rejects.toThrow('NO_DATA')
  })

  it('returns parsed habit insight JSON and enforces minimum data', async () => {
    await expect(generateHabitInsight([baseHabit as any], [baseHabitLog as any, baseHabitLog as any])).resolves.toBeNull()

    mockedChatCompletion.mockResolvedValueOnce(JSON.stringify({
      consistency_summary: 'Steady overall.',
      strongest_habit: 'Walk stands out.',
      needs_attention: 'All habits on track.',
      encouragement: 'Keep going.',
      tip: 'Walk before lunch.',
    }))

    const insight = await generateHabitInsight(
      [baseHabit as any],
      [baseHabitLog as any, baseHabitLog as any, baseHabitLog as any]
    )

    expect(insight).toMatchObject({
      consistency_summary: 'Steady overall.',
      strongest_habit: 'Walk stands out.',
    })
    expect(mockedChatCompletion.mock.calls[0][1]).toMatchObject({ temperature: 0.4, max_tokens: 450 })
  })

  it('habit prompt includes last-14-days timeline and day pattern', async () => {
    mockedChatCompletion.mockResolvedValueOnce(JSON.stringify({
      consistency_summary: 'x', strongest_habit: 'x', needs_attention: 'x', encouragement: 'x', tip: 'x',
    }))
    await generateHabitInsight(
      [baseHabit as any],
      [baseHabitLog as any, baseHabitLog as any, baseHabitLog as any]
    )
    const prompt = mockedChatCompletion.mock.calls[0][0][1].content
    expect(prompt).toContain('Last 14 days')
    expect(prompt).toContain('completion:')
    expect(prompt).toContain('streak:')
  })

  it('returns parsed journal reflection JSON and handles invalid model output', async () => {
    await expect(generateJournalReflection([baseJournal as any, baseJournal as any])).resolves.toBeNull()

    mockedChatCompletion
      .mockResolvedValueOnce(JSON.stringify({
        mood_summary: 'Mostly positive.',
        themes: ['focus', 'health'],
        recurring_questions: ['How do routines affect spending?'],
        gentle_prompt: 'What helped most today?',
      }))
      .mockResolvedValueOnce('not json')

    await expect(generateJournalReflection([baseJournal as any, baseJournal as any, baseJournal as any])).resolves.toMatchObject({
      mood_summary: 'Mostly positive.',
      themes: ['focus', 'health'],
    })
    await expect(generateJournalReflection([baseJournal as any, baseJournal as any, baseJournal as any])).resolves.toBeNull()
  })

  it('builds cross-module prompts from recent finance, habit, and journal data', async () => {
    mockedChatCompletion.mockResolvedValueOnce('cross insight')

    await expect(generateCrossModuleInsights({
      transactions: [baseTx as any],
      categories: [baseCategory as any],
      habits: [{ ...baseHabit, todayCount: 1, streak: 5 } as any],
      journals: [baseJournal as any],
    })).resolves.toBe('cross insight')

    const messages = mockedChatCompletion.mock.calls[0][0]
    expect(messages[1].content).toContain('FINANCE (last 30 days)')
    expect(messages[1].content).toContain('HABITS')
    expect(messages[1].content).toContain('JOURNALS')
  })

  it('includes income transactions in finance summary', async () => {
    mockedChatCompletion.mockResolvedValueOnce('ok')
    const incomeTx = { ...baseTx, amount_cents: 5000000 }
    await generateCrossModuleInsights({
      transactions: [incomeTx as any],
      categories: [baseCategory as any],
      habits: [],
      journals: [],
    })
    const prompt = mockedChatCompletion.mock.calls[0][0][1].content
    expect(prompt).toContain('Income:')
  })

  it('shows N/A avg mood when all journals have null mood', async () => {
    mockedChatCompletion.mockResolvedValueOnce('ok')
    const noMoodJournal = { ...baseJournal, mood: null }
    await generateCrossModuleInsights({
      transactions: [],
      categories: [],
      habits: [{ ...baseHabit, todayCount: 0, streak: 0 } as any],
      journals: [noMoodJournal as any],
    })
    const prompt = mockedChatCompletion.mock.calls[0][0][1].content
    expect(prompt).toContain('N/A')
  })

  it('omits FINANCE section when no recent transactions', async () => {
    mockedChatCompletion.mockResolvedValueOnce('ok')
    await generateCrossModuleInsights({
      transactions: [],
      categories: [],
      habits: [{ ...baseHabit, todayCount: 1, streak: 3 } as any],
      journals: [],
    })
    const prompt = mockedChatCompletion.mock.calls[0][0][1].content
    expect(prompt).not.toContain('FINANCE')
  })

  it('omits HABITS section when habits array is empty', async () => {
    mockedChatCompletion.mockResolvedValueOnce('ok')
    await generateCrossModuleInsights({
      transactions: [baseTx as any],
      categories: [baseCategory as any],
      habits: [],
      journals: [],
    })
    const prompt = mockedChatCompletion.mock.calls[0][0][1].content
    expect(prompt).not.toContain('HABITS:')
  })

  it('omits JOURNALS section when no recent journals', async () => {
    mockedChatCompletion.mockResolvedValueOnce('ok')
    await generateCrossModuleInsights({
      transactions: [baseTx as any],
      categories: [baseCategory as any],
      habits: [],
      journals: [],
    })
    const prompt = mockedChatCompletion.mock.calls[0][0][1].content
    expect(prompt).not.toContain('JOURNALS')
  })
})
