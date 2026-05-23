jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }))
jest.mock('../database/settings/queries', () => ({ getAllSettings: jest.fn().mockResolvedValue({}) }))
jest.mock('../services/ai/openai', () => ({
  chatCompletion: jest.fn(),
}))

import { chatCompletion } from '../services/ai/openai'
import { parseUniversalCandidates, parseUniversalEntry } from '../services/ai/universalEntry'

const mockedChatCompletion = chatCompletion as jest.MockedFunction<typeof chatCompletion>

describe('parseUniversalEntry', () => {
  beforeEach(() => {
    mockedChatCompletion.mockReset()
  })

  it('normalizes finance occurred_at with timezone offset to UTC ISO', async () => {
    mockedChatCompletion.mockResolvedValue(JSON.stringify({
      module: 'finance',
      amount_cents: 50000,
      direction: 'expense',
      category_hint: 'Dining Out',
      merchant: 'Cafe',
      note: '',
      occurred_at: '2026-05-19T22:00:00+07:00',
    }))

    const parsed = await parseUniversalEntry('cafe 50.000')

    expect(parsed).toMatchObject({
      module: 'finance',
      occurred_at: '2026-05-19T15:00:00.000Z',
    })
  })

  it('parses candidate response format', async () => {
    mockedChatCompletion.mockResolvedValue(JSON.stringify({
      candidates: [
        {
          confidence: 0.91,
          reason: 'future task',
          selectedByDefault: true,
          entry: {
            module: 'reminder',
            title: 'Team meeting',
            remind_at: '2099-05-19T09:00:00+07:00',
            recurrence: 'none',
            note: '',
          },
        },
      ],
    }))

    const parsed = await parseUniversalCandidates('nhac hop team mai 9h')

    expect(parsed).toHaveLength(1)
    expect(parsed[0]).toMatchObject({
      confidence: 0.91,
      entry: { module: 'reminder', title: 'Team meeting' },
    })
  })

  it('adds journal candidate for financial event with emotion', async () => {
    mockedChatCompletion.mockResolvedValue(JSON.stringify({
      candidates: [
        {
          confidence: 0.9,
          reason: 'income amount',
          selectedByDefault: true,
          entry: {
            module: 'finance',
            amount_cents: 2000000,
            direction: 'income',
            category_hint: 'Other Income',
            merchant: '',
            note: '',
            occurred_at: '2026-05-19T22:00:00+07:00',
          },
        },
      ],
    }))

    const parsed = await parseUniversalCandidates('hom nay vui vi lam ra 2 trieu dong')

    expect(parsed.map((c) => c.entry.module)).toEqual(['finance', 'journal'])
    expect(parsed.find((c) => c.entry.module === 'journal')?.selectedByDefault).toBe(true)
  })
})
