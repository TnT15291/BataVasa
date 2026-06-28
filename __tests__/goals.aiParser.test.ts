jest.mock('../services/ai/openai', () => ({ chatCompletion: jest.fn() }))
jest.mock('../services/ai/aiLanguage', () => ({ getAILanguage: () => 'English' }))

import { chatCompletion } from '../services/ai/openai'
import { parseGoalEntry } from '../features/goals/aiParser'

const mockChat = chatCompletion as jest.MockedFunction<typeof chatCompletion>

const opts = {
  currency: 'USD',
  categories: [
    { id: 'food', name: 'Dining Out', kind: 'discretionary' },
    { id: 'fund', name: 'Emergency Fund', kind: 'savings' },
    { id: 'salary', name: 'Freelance', kind: 'income' },
  ] as any,
  habits: [
    { id: 'h1', name: 'Meditate' },
    { id: 'h2', name: 'Exercise' },
  ] as any,
  journalTags: ['all', 'health', 'money'] as const,
}

beforeEach(() => jest.clearAllMocks())

describe('parseGoalEntry supported goal boundary', () => {
  it('rejects goals BataVasa does not directly measure before calling AI', async () => {
    await expect(parseGoalEntry('lose 5kg by September', opts)).resolves.toBeNull()
    await expect(parseGoalEntry('sleep 8 hours every night', opts)).resolves.toBeNull()
    await expect(parseGoalEntry('have no overdue tasks', opts)).resolves.toBeNull()
    await expect(parseGoalEntry('pay off debt to Minh', opts)).resolves.toBeNull()
    await expect(parseGoalEntry('keep mood above 4/5', opts)).resolves.toBeNull()

    expect(mockChat).not.toHaveBeenCalled()
  })

  it('accepts measurable finance, habit, journal, and task goals', async () => {
    mockChat
      .mockResolvedValueOnce(JSON.stringify({
        title: 'Save 5000 USD',
        description: '',
        source: 'finance',
        source_hint: 'Emergency Fund',
        target_value: 5000,
        start_date: '2026-06-28',
        due_date: null,
      }))
      .mockResolvedValueOnce(JSON.stringify({
        title: 'Meditate 30 sessions',
        description: '',
        source: 'habits',
        source_hint: 'Meditate',
        target_value: 999,
        start_date: '2026-06-28',
        due_date: null,
      }))
      .mockResolvedValueOnce(JSON.stringify({
        title: 'Write 10 health journals',
        description: '',
        source: 'journals',
        source_hint: 'health',
        target_value: 10,
        start_date: '2026-06-28',
        due_date: null,
      }))
      .mockResolvedValueOnce(JSON.stringify({
        title: 'Complete 20 tasks',
        description: '',
        source: 'reminders',
        source_hint: '',
        target_value: 20,
        start_date: '2026-06-28',
        due_date: null,
      }))

    await expect(parseGoalEntry('save 5000 USD for Emergency Fund', opts))
      .resolves.toMatchObject({ source: 'finance', target_value: 5000, source_hint: 'Emergency Fund' })
    await expect(parseGoalEntry('meditate 30 sessions this month', opts))
      .resolves.toMatchObject({ source: 'habits', target_value: 30, habit_aggregation: 'completion_count' })
    await expect(parseGoalEntry('write 10 health journals', opts))
      .resolves.toMatchObject({ source: 'journals', target_value: 10, source_hint: 'health' })
    await expect(parseGoalEntry('complete 20 tasks this month', opts))
      .resolves.toMatchObject({ source: 'reminders', target_value: 20 })
  })

  it('honors AI unsupported responses as a fallback guard', async () => {
    mockChat.mockResolvedValueOnce('{"unsupported":true}')

    await expect(parseGoalEntry('some unsupported custom metric', opts)).resolves.toBeNull()
  })
})
