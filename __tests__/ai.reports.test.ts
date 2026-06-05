jest.mock('../services/ai/openai', () => ({
  chatCompletion: jest.fn(),
}))
jest.mock('../services/ai/aiLanguage', () => ({
  getAILanguage: () => 'English',
  getAICurrency: () => 'USD',
  fmtAI: (cents: number, _currency: string) => `$${(cents / 100).toFixed(2)}`,
}))

import { chatCompletion } from '../services/ai/openai'
import {
  generateReport,
  generateWeeklyReport,
  generateMonthlyReport,
} from '../services/ai/reports'
import type { Transaction, Category } from '../features/finance/types'

const mockChat = chatCompletion as jest.Mock

const catId = 'cat-1'
const baseCategory: Category = {
  id: catId,
  user_id: 'user-1',
  name: 'Food',
  icon: 'tag',
  color: '#22C55E',
  kind: 'essential',
  parent_id: null,
  sort_order: 0,
  monthly_budget_cents: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  synced_at: null,
}

const makeTx = (amount_cents: number): Transaction => ({
  id: 'tx-1',
  user_id: 'user-1',
  amount_cents,
  currency: 'USD',
  category_id: catId,
  merchant: 'Cafe',
  note: null,
  occurred_at: '2026-01-01T10:00:00.000Z',
  mood: null,
  source: 'manual',
  needs_review: 0,
  review_reason: null,
  location_lat: null,
  location_lng: null,
  location_label: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  synced_at: null,
})

beforeEach(() => jest.resetAllMocks())

describe('generateReport', () => {
  it('throws NO_DATA when no transactions', async () => {
    await expect(generateReport([], [baseCategory], 'this week', 'weekly')).rejects.toThrow('NO_DATA')
    expect(mockChat).not.toHaveBeenCalled()
  })

  it('calls chatCompletion and returns result', async () => {
    mockChat.mockResolvedValue('## Weekly report\nAll good.')
    const result = await generateReport([makeTx(-5000)], [baseCategory], 'this week', 'weekly')
    expect(result).toBe('## Weekly report\nAll good.')
    expect(mockChat).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ role: 'system' }),
      expect.objectContaining({ role: 'user', content: expect.stringContaining('this week') }),
    ]))
  })

  it('includes income and expense in prompt data', async () => {
    mockChat.mockResolvedValue('report text')
    const txs = [makeTx(-5000), makeTx(10000)]
    await generateReport(txs, [baseCategory], 'January', 'monthly')
    const [, userMsg] = mockChat.mock.calls[0][0]
    expect(userMsg.content).toContain('Total income')
    expect(userMsg.content).toContain('Total expense')
  })

  it('handles transactions with unknown category', async () => {
    mockChat.mockResolvedValue('ok')
    const tx = { ...makeTx(-3000), category_id: 'unknown-cat' }
    await generateReport([tx], [baseCategory], 'this month', 'monthly')
    const [, userMsg] = mockChat.mock.calls[0][0]
    expect(userMsg.content).toContain('Other')
  })

  it('uses correct sections for each report type', async () => {
    mockChat.mockResolvedValue('ok')
    for (const type of ['weekly', 'monthly', 'quarterly', 'yearly', 'custom'] as const) {
      await generateReport([makeTx(-1000)], [baseCategory], 'period', type)
    }
    expect(mockChat).toHaveBeenCalledTimes(5)
  })
})

describe('generateWeeklyReport', () => {
  it('delegates to generateReport with weekly type', async () => {
    mockChat.mockResolvedValue('weekly summary')
    const result = await generateWeeklyReport([makeTx(-2000)], [baseCategory])
    expect(result).toBe('weekly summary')
    const [, userMsg] = mockChat.mock.calls[0][0]
    expect(userMsg.content).toContain('this week')
  })
})

describe('generateMonthlyReport', () => {
  it('delegates to generateReport with monthly type', async () => {
    mockChat.mockResolvedValue('monthly summary')
    const result = await generateMonthlyReport([makeTx(-2000)], [baseCategory])
    expect(result).toBe('monthly summary')
    const [, userMsg] = mockChat.mock.calls[0][0]
    expect(userMsg.content).toContain('this month')
  })
})
