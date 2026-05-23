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
  findDuplicateTransaction,
  wipeFinanceData,
  insertCategory,
  updateCategory,
  softDeleteCategory,
  exportFinanceData,
} from '../database/finance/queries'
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

    await expect(getTransaction('tx-1')).resolves.toBe(baseTx)
    await expect(listTransactions({ from: '2026-01-01', to: '2026-01-31', categoryId: 'cat-1', limit: 10, offset: 5 })).resolves.toEqual([baseTx])
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('category_id = ?'),
      ['2026-01-01', '2026-01-31', 'cat-1', 10, 5]
    )
    await expect(findDuplicateTransaction(-100, 'Cafe', 1000)).resolves.toBe(baseTx)
  })

  it('wipes finance data with counts', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({ n: 2 }).mockResolvedValueOnce({ n: 1 }).mockResolvedValueOnce({ n: 3 })
    await expect(wipeFinanceData()).resolves.toEqual({ transactions: 2, categories: 1, rules: 3 })
    expect(mockDb.execAsync).toHaveBeenCalledWith('DELETE FROM finance_transaction')
    expect(mockDb.execAsync).toHaveBeenCalledWith('DELETE FROM finance_rule')
    expect(mockDb.execAsync).toHaveBeenCalledWith('DELETE FROM finance_category WHERE user_id IS NOT NULL')
  })

  it('inserts, updates, deletes, and exports categories', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([baseTx]).mockResolvedValueOnce([baseCategory]).mockResolvedValueOnce([])
    await insertCategory(baseCategory)
    await updateCategory('cat-1', { name: 'Groceries', id: 'ignored' } as any)
    await softDeleteCategory('cat-1', '2026-01-02T00:00:00.000Z')
    const exported = await exportFinanceData()

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
  })
})
