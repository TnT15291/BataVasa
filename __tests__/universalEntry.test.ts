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

  it('returns [] when chatCompletion throws', async () => {
    mockedChatCompletion.mockRejectedValue(new Error('network error'))
    const result = await parseUniversalCandidates('50k cafe')
    expect(result).toEqual([])
  })

  it('returns [] when AI returns no JSON', async () => {
    mockedChatCompletion.mockResolvedValue('Sorry, I cannot help with that.')
    const result = await parseUniversalCandidates('something')
    expect(result).toEqual([])
  })

  it('handles raw array response from AI', async () => {
    mockedChatCompletion.mockResolvedValue(JSON.stringify([
      {
        confidence: 0.8,
        reason: 'habits',
        selectedByDefault: true,
        entry: { module: 'habits', title: 'Morning run', frequency: 'daily' },
      },
    ]))
    const result = await parseUniversalCandidates('tap chay sang moi ngay')
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]?.entry.module).toBe('habits')
  })

  it('normalizeEntry returns null for missing module', async () => {
    mockedChatCompletion.mockResolvedValue(JSON.stringify({ candidates: [
      { confidence: 0.5, reason: 'x', selectedByDefault: true, entry: { foo: 'bar' } },
    ]}))
    const result = await parseUniversalCandidates('test')
    expect(result).toEqual([])
  })

  it('normalizeEntry returns null for finance with zero amount', async () => {
    mockedChatCompletion.mockResolvedValue(JSON.stringify({ candidates: [
      { confidence: 0.8, reason: 'x', selectedByDefault: true, entry: {
        module: 'finance', amount_cents: 0, direction: 'expense',
        category_hint: 'Food', merchant: '', note: '', occurred_at: '2026-01-01T00:00:00Z',
      }},
    ]}))
    const result = await parseUniversalCandidates('test')
    expect(result).toEqual([])
  })

  it('normalizeEntry uses income category_hint for income direction', async () => {
    mockedChatCompletion.mockResolvedValue(JSON.stringify({ candidates: [
      { confidence: 0.9, reason: 'x', selectedByDefault: true, entry: {
        module: 'finance', amount_cents: 100000, direction: 'income',
        category_hint: '', merchant: '', note: '', occurred_at: '2099-01-01T00:00:00Z',
      }},
    ]}))
    const result = await parseUniversalCandidates('nhan tien')
    expect(result.length).toBe(1)
    const entry = result[0]!.entry as any
    expect(entry.direction).toBe('income')
    expect(entry.category_hint).toBe('Other Income')
  })

  it('normalizeEntry falls back for invalid reminder remind_at', async () => {
    mockedChatCompletion.mockResolvedValue(JSON.stringify({ candidates: [
      { confidence: 0.8, reason: 'x', selectedByDefault: true, entry: {
        module: 'reminder', title: 'Call mom', remind_at: 'not-a-date', recurrence: 'none', note: '',
      }},
    ]}))
    const result = await parseUniversalCandidates('nhac goi me')
    expect(result.length).toBe(1)
    expect(result[0]?.entry.module).toBe('reminder')
  })

  it('normalizeEntry normalizes unknown recurrence to none', async () => {
    mockedChatCompletion.mockResolvedValue(JSON.stringify({ candidates: [
      { confidence: 0.8, reason: 'x', selectedByDefault: true, entry: {
        module: 'reminder', title: 'Gym', remind_at: '2099-06-01T07:00:00Z', recurrence: 'yearly', note: '',
      }},
    ]}))
    const result = await parseUniversalCandidates('nhac gym')
    expect(result.length).toBe(1)
    const entry = result[0]!.entry as any
    expect(entry.recurrence).toBe('none')
  })

  it('normalizeEntry returns null for habits with no title', async () => {
    mockedChatCompletion.mockResolvedValue(JSON.stringify({ candidates: [
      { confidence: 0.7, reason: 'x', selectedByDefault: true, entry: {
        module: 'habits', title: '', frequency: 'daily',
      }},
    ]}))
    const result = await parseUniversalCandidates('tap the duc')
    expect(result).toEqual([])
  })

  it('preserves short Vietnamese habit title from user input when AI damages tone marks', async () => {
    mockedChatCompletion.mockResolvedValue(JSON.stringify({ candidates: [
      { confidence: 0.9, reason: 'habit', selectedByDefault: true, entry: {
        module: 'habits', title: 'Uương nước', frequency: 'daily',
      }},
    ]}))
    const result = await parseUniversalCandidates('uống nước')
    expect(result).toHaveLength(1)
    expect(result[0]?.entry).toMatchObject({ module: 'habits', title: 'uống nước' })
  })

  it('keeps AI habit target_per_period when present', async () => {
    mockedChatCompletion.mockResolvedValue(JSON.stringify({ candidates: [
      { confidence: 0.9, reason: 'habit', selectedByDefault: true, entry: {
        module: 'habits', title: 'tập thở', frequency: 'daily', target_per_period: 5,
      }},
    ]}))
    const result = await parseUniversalCandidates('tập thở 5 lần 1 ngày')
    expect(result[0]?.entry).toMatchObject({ module: 'habits', title: 'tập thở', target_per_period: 5 })
  })

  it('infers habit target_per_period from Vietnamese text when AI omits it', async () => {
    mockedChatCompletion.mockResolvedValue(JSON.stringify({ candidates: [
      { confidence: 0.9, reason: 'habit', selectedByDefault: true, entry: {
        module: 'habits', title: 'tập thở', frequency: 'daily',
      }},
    ]}))
    const result = await parseUniversalCandidates('tập thở 5 lần 1 ngày')
    expect(result[0]?.entry).toMatchObject({ module: 'habits', title: 'tập thở', target_per_period: 5 })
  })

  it('normalizeEntry returns null for journal with empty content', async () => {
    mockedChatCompletion.mockResolvedValue(JSON.stringify({ candidates: [
      { confidence: 0.7, reason: 'x', selectedByDefault: true, entry: {
        module: 'journal', content: '   ',
      }},
    ]}))
    const result = await parseUniversalCandidates('   ')
    expect(result).toEqual([])
  })

  it('dedupes non-finance duplicate modules', async () => {
    mockedChatCompletion.mockResolvedValue(JSON.stringify({ candidates: [
      { confidence: 0.9, reason: 'x', selectedByDefault: true, entry: { module: 'habits', title: 'Run', frequency: 'daily' } },
      { confidence: 0.7, reason: 'y', selectedByDefault: false, entry: { module: 'habits', title: 'Run again', frequency: 'daily' } },
    ]}))
    const result = await parseUniversalCandidates('chay bo hang ngay')
    const habitCandidates = result.filter((c) => c.entry.module === 'habits')
    expect(habitCandidates).toHaveLength(1)
  })

  it('keeps multiple finance entries without deduplication', async () => {
    mockedChatCompletion.mockResolvedValue(JSON.stringify({ candidates: [
      { confidence: 0.9, reason: 'x', selectedByDefault: true, entry: {
        module: 'finance', amount_cents: 30000, direction: 'expense',
        category_hint: 'Food', merchant: 'Cafe', note: '', occurred_at: '2099-01-01T00:00:00Z',
      }},
      { confidence: 0.85, reason: 'y', selectedByDefault: true, entry: {
        module: 'finance', amount_cents: 50000, direction: 'expense',
        category_hint: 'Transport', merchant: 'Taxi', note: '', occurred_at: '2099-01-01T00:00:00Z',
      }},
    ]}))
    const result = await parseUniversalCandidates('cafe 30k va taxi 50k')
    const financeCandidates = result.filter((c) => c.entry.module === 'finance')
    expect(financeCandidates).toHaveLength(2)
  })

  it('income guard adds finance candidate when AI misses income text', async () => {
    mockedChatCompletion.mockResolvedValue(JSON.stringify({ candidates: [] }))
    const result = await parseUniversalCandidates('received 5000k income today')
    const finance = result.find((c) => c.entry.module === 'finance')
    expect(finance).toBeDefined()
    if (finance) {
      const entry = finance.entry as any
      expect(entry.direction).toBe('income')
    }
  })

  it('salary keyword maps to Salary category in income guard', async () => {
    mockedChatCompletion.mockResolvedValue(JSON.stringify({ candidates: [] }))
    const result = await parseUniversalCandidates('salary received 5000k')
    const finance = result.find((c) => c.entry.module === 'finance')
    if (finance) {
      const entry = finance.entry as any
      expect(entry.category_hint).toBe('Salary')
    }
  })

  it('parseUniversalEntry returns null when no candidates', async () => {
    mockedChatCompletion.mockResolvedValue('no json here')
    const result = await parseUniversalEntry('something')
    expect(result).toBeNull()
  })
})
