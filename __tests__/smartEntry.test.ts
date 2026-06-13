jest.mock('../services/ai/openai', () => ({ chatCompletion: jest.fn() }))
jest.mock('../services/ai/aiLanguage', () => ({
  getAILanguage: () => 'Vietnamese',
  getAICurrency: () => 'VND',
  getAmountRule: () => 'Store raw VND amount',
}))

import { chatCompletion } from '../services/ai/openai'
import { hasMultipleAmounts, extractAmount, parseSmartEntry } from '../services/ai/smartEntry'
import type { Category } from '../features/finance/types'

const mockChat = chatCompletion as jest.Mock

const baseCategory: Category = {
  id: 'cat-1', user_id: 'u1', name: 'Food', icon: 'tag', color: '#22C55E',
  kind: 'essential', parent_id: null, sort_order: 0, monthly_budget_cents: null,
  created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null, synced_at: null,
}

beforeEach(() => jest.resetAllMocks())

describe('hasMultipleAmounts', () => {
  it('returns true for text with two k amounts', () => {
    expect(hasMultipleAmounts('ăn 50k và cafe 30k')).toBe(true)
  })
  it('returns true for two k amounts', () => {
    expect(hasMultipleAmounts('cafe 30k và trà sữa 40k')).toBe(true)
  })
  it('returns false for single amount', () => {
    expect(hasMultipleAmounts('ăn sáng 50k')).toBe(false)
  })
  it('returns false for no amount', () => {
    expect(hasMultipleAmounts('xem phim hôm nay')).toBe(false)
  })
})

describe('extractAmount', () => {
  describe('VND (no minor unit)', () => {
    it('extracts k suffix', () => expect(extractAmount('50k cafe', 'VND')).toBe(50000))
    it('extracts tr suffix', () => expect(extractAmount('1.5tr xe', 'VND')).toBe(1500000))
    it('extracts triệu', () => expect(extractAmount('2 triệu', 'VND')).toBe(2000000))
    it('extracts ngàn', () => expect(extractAmount('30 ngàn', 'VND')).toBe(30000))
    it('extracts nghìn', () => expect(extractAmount('20 nghìn', 'VND')).toBe(20000))
    it('extracts M suffix', () => expect(extractAmount('1M', 'VND')).toBe(1000000))
    it('extracts grouped number', () => expect(extractAmount('50.000đ', 'VND')).toBe(50000))
    it('extracts raw number', () => expect(extractAmount('100000', 'VND')).toBe(100000))
    it('returns null when no amount found', () => expect(extractAmount('xem phim', 'VND')).toBeNull())
  })

  describe('USD (minor unit = cents)', () => {
    it('multiplies by 100 for USD', () => expect(extractAmount('50k coffee', 'USD')).toBe(50000 * 100))
  })

  describe('JPY (no minor unit but ×100)', () => {
    it('multiplies by 100 for JPY', () => expect(extractAmount('1000', 'JPY')).toBe(100000))
  })

  describe('KRW', () => {
    it('multiplies by 100 for KRW', () => expect(extractAmount('5000', 'KRW')).toBe(500000))
  })
})

describe('parseSmartEntry', () => {
  it('returns parsed entry on success', async () => {
    mockChat.mockResolvedValue('{"amount_cents":50000,"direction":"expense","category_hint":"Food","merchant":"Cafe","note":""}')
    const result = await parseSmartEntry('50k cafe', [baseCategory])
    expect(result).not.toBeNull()
    expect(result?.amount_cents).toBe(50000)
    expect(result?.direction).toBe('expense')
    const [, userMsg] = mockChat.mock.calls[0][0]
    expect(userMsg.content).not.toContain('Available funds')
    expect(userMsg.content).not.toContain('fund_hint')
    expect(userMsg.content).toContain('ordinary expense categories')
  })

  it('treats fund wording as a category-only parse', async () => {
    mockChat.mockResolvedValue('{"amount_cents":200000,"direction":"expense","category_hint":"Learning Fund","merchant":"","note":"swimming class"}')
    const result = await parseSmartEntry('hoc boi 200k quy hoc tap', [baseCategory, { ...baseCategory, name: 'Learning Fund' }])
    expect(result?.category_hint).toBe('Learning Fund')
  })

  it('replaces income category_hint when AI marks a normal expense', async () => {
    mockChat.mockResolvedValue('{"amount_cents":100000,"direction":"expense","category_hint":"Other Income","merchant":"","note":""}')
    const result = await parseSmartEntry('chi tieu 100k', [
      baseCategory,
      { ...baseCategory, id: 'cat-shopping', name: 'Shopping', kind: 'discretionary' },
      { ...baseCategory, id: 'cat-income', name: 'Other Income', kind: 'income' },
    ])
    expect(result?.intent).toBe('transaction')
    expect(result?.direction).toBe('expense')
    expect(result?.category_hint).toBe('Shopping')
  })

  it('returns null when AI response has no JSON', async () => {
    mockChat.mockResolvedValue('Sorry, I cannot parse that.')
    const result = await parseSmartEntry('some text', [baseCategory])
    expect(result).toBeNull()
  })

  it('returns null when amount_cents is zero', async () => {
    mockChat.mockResolvedValue('{"amount_cents":0,"direction":"expense","category_hint":"Food","merchant":"","note":""}')
    const result = await parseSmartEntry('test', [baseCategory])
    expect(result).toBeNull()
  })

  it('returns null when amount_cents is negative', async () => {
    mockChat.mockResolvedValue('{"amount_cents":-100,"direction":"expense","category_hint":"Food","merchant":"","note":""}')
    const result = await parseSmartEntry('test', [baseCategory])
    expect(result).toBeNull()
  })

  it('overrides AI amount when ratio ≥ 10 (AI hallucinated)', async () => {
    // extractAmount returns 50000 for '50k'; AI returns 500000 (10× too high)
    mockChat.mockResolvedValue('{"amount_cents":500000,"direction":"expense","category_hint":"Food","merchant":"","note":""}')
    const result = await parseSmartEntry('50k cafe', [baseCategory])
    expect(result?.amount_cents).toBe(50000)
  })

  it('overrides AI amount when ratio ≤ 0.1 (AI too low)', async () => {
    // extractAmount returns 50000; AI returns 4000 (ratio=0.08)
    mockChat.mockResolvedValue('{"amount_cents":4000,"direction":"expense","category_hint":"Food","merchant":"","note":""}')
    const result = await parseSmartEntry('50k cafe', [baseCategory])
    expect(result?.amount_cents).toBe(50000)
  })

  it('returns null when chatCompletion throws', async () => {
    mockChat.mockRejectedValue(new Error('network error'))
    const result = await parseSmartEntry('50k cafe', [baseCategory])
    expect(result).toBeNull()
  })

  it('does not override amount when ratio is within acceptable range', async () => {
    // extractAmount returns 50000; AI returns 50000 (ratio=1, within range)
    mockChat.mockResolvedValue('{"amount_cents":50000,"direction":"expense","category_hint":"Food","merchant":"Cafe","note":"iced"}')
    const result = await parseSmartEntry('50k cafe', [baseCategory])
    expect(result?.amount_cents).toBe(50000)
    expect(result?.merchant).toBe('cafe')
  })

  it('routes monthly spending wording to a plan item, not a transaction', async () => {
    mockChat.mockResolvedValue('{"amount_cents":1000000,"direction":"expense","category_hint":"Food","merchant":"","note":""}')
    const result = await parseSmartEntry('Thêm khoản chi tiêu hằng tháng tiền điện 1tr', [baseCategory])
    expect(result?.intent).toBe('plan_item')
    if (result?.intent !== 'plan_item') throw new Error('Expected plan item')
    expect(result.kind).toBe('expense')
    expect(result.amount_cents).toBe(1000000)
    expect(result.name).toContain('tiền điện')
  })

  it('routes borrowed money wording to debt book as borrowed', async () => {
    mockChat.mockResolvedValue('{"amount_cents":2000000,"direction":"expense","category_hint":"Food","merchant":"","note":""}')
    const result = await parseSmartEntry('Vay của Anh Quang 2m trả vào ngày 10 tháng sau', [baseCategory])
    expect(result?.intent).toBe('debt')
    if (result?.intent !== 'debt') throw new Error('Expected debt')
    expect(result.debt_direction).toBe('borrowed')
    expect(result.amount_cents).toBe(2000000)
    expect(result.counterparty).toBe('Anh Quang')
    expect(result.due_at).not.toBeNull()
  })

  it('routes vay name amount date wording to borrowed debt and keeps amount positive', async () => {
    mockChat.mockResolvedValue('{"amount_cents":-17000000,"direction":"expense","category_hint":"Other Income","merchant":"","note":""}')
    const result = await parseSmartEntry('Vay anh Hung 17m ngay 19 tra', [baseCategory])
    expect(result?.intent).toBe('debt')
    if (result?.intent !== 'debt') throw new Error('Expected debt')
    expect(result.debt_direction).toBe('borrowed')
    expect(result.amount_cents).toBe(17000000)
    expect(result.counterparty).toBe('anh Hung')
    expect(result.due_at).not.toBeNull()
  })
})
