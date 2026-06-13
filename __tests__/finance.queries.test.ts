const mockDb = {
  runAsync: jest.fn(),
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
  execAsync: jest.fn(),
}

jest.mock('../database/core/db', () => ({
  getDb: jest.fn(() => Promise.resolve(mockDb)),
}))

import {
  insertTransaction,
  updateTransaction,
  softDeleteTransaction,
  getTransaction,
  listTransactions,
  listCategories,
  getCategory,
  findDuplicateTransaction,
  wipeFinanceData,
  insertCategory,
  updateCategory,
  softDeleteCategory,
  exportFinanceData,
  upsertTransactionRule,
  findRuleForMerchant,
  findRuleByPattern,
  listTransactionRules,
} from '../database/finance/queries'
import type { TransactionRule } from '../features/finance/types'
import type { Category, Transaction } from '../features/finance/types'

const baseTx: Transaction = {
  id: 'tx-1',
  user_id: 'user-1',
  amount_cents: -100,
  currency: 'USD',
  category_id: 'cat-1',
  merchant: 'Cafe',
  note: null,
  occurred_at: '2026-01-01T00:00:00.000Z',
  mood: null,
  source: 'manual',
  needs_review: 0,
  review_reason: null,
  location_lat: null,
  location_lng: null,
  location_label: null,
  plan_item_id: null,
  plan_match_dismissed: 0,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  synced_at: null,
}

const baseCategory: Category = {
  id: 'cat-1',
  user_id: 'user-1',
  name: 'Food',
  icon: 'tag',
  color: '#22C55E',
  kind: 'essential',
  parent_id: null,
  sort_order: 1,
  monthly_budget_cents: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  synced_at: null,
}

beforeEach(() => jest.clearAllMocks())

describe('finance queries', () => {
  it('inserts and patches transactions', async () => {
    await insertTransaction(baseTx)
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO finance_transaction'),
      expect.arrayContaining(['tx-1', -100])
    )

    await updateTransaction('tx-1', { note: 'updated', id: 'ignored' } as any)
    expect(mockDb.runAsync).toHaveBeenLastCalledWith(
      expect.stringContaining('UPDATE finance_transaction SET note = ? WHERE id = ?'),
      ['updated', 'tx-1']
    )
  })

  it('no-ops empty transaction patch and soft-deletes', async () => {
    await updateTransaction('tx-1', { id: 'tx-1' } as any)
    expect(mockDb.runAsync).not.toHaveBeenCalled()

    await softDeleteTransaction('tx-1', '2026-01-02T00:00:00.000Z')
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('deleted_at = ?'),
      ['2026-01-02T00:00:00.000Z', '2026-01-02T00:00:00.000Z', 'tx-1']
    )
  })

  it('gets, lists, and duplicate-checks transactions', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(baseTx).mockResolvedValueOnce(baseTx)
    mockDb.getAllAsync.mockResolvedValueOnce([baseTx])

    await expect(getTransaction('tx-1', 'user-1')).resolves.toBe(baseTx)
    await expect(listTransactions('user-1', { from: '2026-01-01', to: '2026-01-31', categoryId: 'cat-1', limit: 10, offset: 5 })).resolves.toEqual([baseTx])
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('user_id = ?'),
      ['user-1', '2026-01-01', '2026-01-31', 'cat-1', 10, 5]
    )
    await expect(findDuplicateTransaction(-100, 'Cafe', 'user-1', 1000)).resolves.toBe(baseTx)
  })

  it('wipes finance data with counts (scoped to user)', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({ n: 2 }).mockResolvedValueOnce({ n: 1 }).mockResolvedValueOnce({ n: 3 }).mockResolvedValueOnce({ n: 4 }).mockResolvedValueOnce({ n: 5 })
    await expect(wipeFinanceData('user-1')).resolves.toEqual({ transactions: 2, categories: 1, rules: 3, planItems: 4, debts: 5 })
    expect(mockDb.runAsync).toHaveBeenCalledWith('DELETE FROM finance_transaction WHERE user_id = ?', ['user-1'])
    expect(mockDb.runAsync).toHaveBeenCalledWith('DELETE FROM finance_rule WHERE user_id = ?', ['user-1'])
    expect(mockDb.runAsync).toHaveBeenCalledWith('DELETE FROM finance_plan_item WHERE user_id = ?', ['user-1'])
    expect(mockDb.runAsync).toHaveBeenCalledWith('DELETE FROM finance_debt WHERE user_id = ?', ['user-1'])
    expect(mockDb.runAsync).toHaveBeenCalledWith('DELETE FROM finance_category WHERE user_id = ?', ['user-1'])
  })

  it('scopes category reads to system + owner (isolation)', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([baseCategory])
    await listCategories('user-1')
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('user_id IS NULL OR user_id = ?'),
      ['user-1']
    )
  })

  it('inserts, updates, deletes, and exports categories', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([baseTx]).mockResolvedValueOnce([baseCategory]).mockResolvedValueOnce([]).mockResolvedValueOnce([])
    await insertCategory(baseCategory)
    await updateCategory('cat-1', { name: 'Groceries', id: 'ignored' } as any)
    await softDeleteCategory('cat-1', '2026-01-02T00:00:00.000Z')
    const exported = await exportFinanceData('user-1')

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO finance_category'),
      expect.arrayContaining(['cat-1', 'Food'])
    )
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE finance_category SET name = ? WHERE id = ?'),
      ['Groceries', 'cat-1']
    )
    expect(exported.categories).toEqual([baseCategory])
    expect(exported.transactions).toEqual([baseTx])
    expect(exported.planItems).toEqual([])
  })

  it('no-ops empty category patch', async () => {
    await updateCategory('cat-1', { id: 'cat-1' } as any)
    expect(mockDb.runAsync).not.toHaveBeenCalled()
  })

  it('gets category by id', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(baseCategory)
    await expect(getCategory('cat-1', 'user-1')).resolves.toBe(baseCategory)
    expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining('finance_category WHERE id = ?'),
      ['cat-1', 'user-1']
    )
  })

  it('returns null from getCategory when not found', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(null)
    await expect(getCategory('missing', 'user-1')).resolves.toBeNull()
  })

  it('listTransactions with needsReview=true filter', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([baseTx])
    await listTransactions('user-1', { needsReview: true })
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('COALESCE(needs_review, 0) = ?'),
      ['user-1', 1, 100, 0]
    )
  })

  it('listTransactions with needsReview=false filter', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([baseTx])
    await listTransactions('user-1', { needsReview: false })
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('COALESCE(needs_review, 0) = ?'),
      ['user-1', 0, 100, 0]
    )
  })

  it('listTransactions with no params uses defaults', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([])
    await listTransactions('user-1')
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY occurred_at DESC LIMIT ? OFFSET ?'),
      ['user-1', 100, 0]
    )
  })

  it('wipeFinanceData returns 0 when counts are null', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null)
    const result = await wipeFinanceData('user-1')
    expect(result).toEqual({ transactions: 0, categories: 0, rules: 0, planItems: 0, debts: 0 })
  })
})

describe('finance rule queries', () => {
  const baseRule: TransactionRule = {
    id: 'rule-1',
    user_id: 'user-1',
    merchant_pattern: 'Starbucks',
    category_id: 'cat-1',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    synced_at: null,
  }

  beforeEach(() => jest.clearAllMocks())

  it('upsertTransactionRule inserts or replaces', async () => {
    await upsertTransactionRule(baseRule)
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO finance_rule'),
      expect.arrayContaining(['rule-1', 'Starbucks', 'cat-1'])
    )
  })

  it('findRuleForMerchant returns null for null merchant', async () => {
    await expect(findRuleForMerchant(null, 'user-1')).resolves.toBeNull()
    expect(mockDb.getFirstAsync).not.toHaveBeenCalled()
  })

  it('findRuleForMerchant returns null for empty merchant', async () => {
    await expect(findRuleForMerchant('   ', 'user-1')).resolves.toBeNull()
    expect(mockDb.getFirstAsync).not.toHaveBeenCalled()
  })

  it('findRuleForMerchant returns matching rule', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(baseRule)
    await expect(findRuleForMerchant('Starbucks', 'user-1')).resolves.toBe(baseRule)
    expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining('finance_rule'),
      ['user-1', 'starbucks', 'starbucks']
    )
  })

  it('findRuleForMerchant returns null when no match', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(null)
    await expect(findRuleForMerchant('Unknown Shop', 'user-1')).resolves.toBeNull()
  })

  it('findRuleByPattern returns matching rule', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(baseRule)
    await expect(findRuleByPattern('Starbucks', 'user-1')).resolves.toBe(baseRule)
    expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining('lower(merchant_pattern) = lower(?)'),
      ['starbucks', 'user-1']
    )
  })

  it('findRuleByPattern returns null when not found', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(null)
    await expect(findRuleByPattern('Unknown', 'user-1')).resolves.toBeNull()
  })

  it('listTransactionRules returns all rules for user', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([baseRule])
    await expect(listTransactionRules('user-1')).resolves.toEqual([baseRule])
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('finance_rule'),
      ['user-1']
    )
  })
})
