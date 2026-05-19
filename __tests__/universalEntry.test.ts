jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }))
jest.mock('../database/settings/queries', () => ({ getAllSettings: jest.fn().mockResolvedValue({}) }))
jest.mock('../services/ai/openai', () => ({
  chatCompletion: jest.fn(),
}))

import { chatCompletion } from '../services/ai/openai'
import { parseUniversalEntry } from '../services/ai/universalEntry'

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
})
