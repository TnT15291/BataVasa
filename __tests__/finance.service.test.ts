jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }))

jest.mock('../database/finance/queries', () => ({
  findDuplicateTransaction: jest.fn(),
  insertTransaction: jest.fn(),
  listTransactions: jest.fn(),
  getTransaction: jest.fn(),
  updateTransaction: jest.fn(),
  softDeleteTransaction: jest.fn(),
  listCategories: jest.fn(),
  getCategory: jest.fn(),
  insertCategory: jest.fn(),
  updateCategory: jest.fn(),
  softDeleteCategory: jest.fn(),
  findRuleForMerchant: jest.fn(),
  findRuleByPattern: jest.fn(),
  upsertTransactionRule: jest.fn(),
  listTransactionRules: jest.fn(),
  wipeFinanceData: jest.fn(),
  exportFinanceData: jest.fn(),
}))

jest.mock('../database/core/db', () => ({
  nowIso: () => '2026-01-01T00:00:00.000Z',
  getDb: jest.fn(),
}))

jest.mock('../database/sync/queue', () => ({ enqueue: jest.fn() }))
jest.mock('../services/uuid', () => ({ uuid: () => 'f47ac10b-58cc-4372-a567-0e02b2c3d479' }))
jest.mock('../services/identity', () => ({ getCurrentUserId: () => 'user-1' }))
jest.mock('../services/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))
jest.mock('../services/analytics', () => ({ track: jest.fn() }))

import * as q from '../database/finance/queries'
import { enqueue } from '../database/sync/queue'
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  listTransactions,
  createCategory,
  updateCategory,
  deleteCategory,
  wipeAllData,
  exportAllData,
  isExpense,
} from '../features/finance/services'
import type { Category, Transaction } from '../features/finance/types'

const mockQ = q as jest.Mocked<typeof q>
const mockEnqueue = enqueue as jest.Mock

const categoryId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const transactionId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

const baseTx: Transaction = {
  id: transactionId,
  user_id: 'user-1',
  amount_cents: -5000,
  currency: 'USD',
  category_id: categoryId,
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
}

const baseCategory: Category = {
  id: categoryId,
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

beforeEach(() => {
  jest.resetAllMocks()
  mockQ.findRuleForMerchant.mockResolvedValue(null)
  mockQ.findRuleByPattern.mockResolvedValue(null)
  mockQ.upsertTransactionRule.mockResolvedValue(undefined)
})

describe('finance service transactions', () => {
  it('creates transaction, trims location, tracks sync', async () => {
    mockQ.findDuplicateTransaction.mockResolvedValue(null)
    mockQ.insertTransaction.mockResolvedValue(undefined)

    const result = await createTransaction({
      amount_cents: -5000,
      currency: 'USD',
      category_id: categoryId,
      merchant: 'Cafe',
      occurred_at: '2026-01-01T10:00:00.000Z',
      source: 'voice',
      location_lat: 10,
      location_lng: 20,
      location_label: '  Home  ',
    })

    expect(result.ok).toBe(true)
    expect(mockQ.insertTransaction).toHaveBeenCalledWith(expect.objectContaining({
      id: transactionId,
      user_id: 'user-1',
      location_label: 'Home',
      source: 'voice',
    }))
    expect(mockEnqueue).toHaveBeenCalledWith('finance_transaction', transactionId, 'upsert')
  })

  it('rejects duplicates before insert', async () => {
    mockQ.findDuplicateTransaction.mockResolvedValue(baseTx)
    const result = await createTransaction({
      amount_cents: -5000,
      currency: 'USD',
      category_id: categoryId,
      occurred_at: '2026-01-01T10:00:00.000Z',
      source: 'manual',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DUPLICATE')
    expect(mockQ.insertTransaction).not.toHaveBeenCalled()
  })

  it('returns validation error for zero amount', async () => {
    const result = await createTransaction({
      amount_cents: 0,
      currency: 'USD',
      category_id: categoryId,
      occurred_at: '2026-01-01T10:00:00.000Z',
      source: 'manual',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_FAILED')
  })

  it('updates transaction and clears blank location', async () => {
    mockQ.getTransaction.mockResolvedValueOnce(baseTx).mockResolvedValueOnce({ ...baseTx, note: 'updated' })
    mockQ.updateTransaction.mockResolvedValue(undefined)
    const result = await updateTransaction({ id: transactionId, note: 'updated', location_label: '   ' })
    expect(result.ok).toBe(true)
    expect(mockQ.updateTransaction).toHaveBeenCalledWith(transactionId, expect.objectContaining({
      note: 'updated',
      location_label: null,
      location_lat: null,
      location_lng: null,
    }))
  })

  it('soft-deletes existing transaction', async () => {
    mockQ.getTransaction.mockResolvedValue(baseTx)
    const result = await deleteTransaction(transactionId)
    expect(result.ok).toBe(true)
    expect(mockQ.softDeleteTransaction).toHaveBeenCalledWith(transactionId, expect.any(String))
  })

  it('loads transactions and maps query failures', async () => {
    mockQ.listTransactions.mockResolvedValueOnce([baseTx]).mockRejectedValueOnce(new Error('locked'))
    expect((await listTransactions()).ok).toBe(true)
    const failed = await listTransactions()
    expect(failed.ok).toBe(false)
    if (!failed.ok) expect(failed.error.code).toBe('DB_ERROR')
  })
})

describe('finance service categories and data management', () => {
  it('creates category after existing sort order', async () => {
    mockQ.listCategories.mockResolvedValue([baseCategory])
    mockQ.insertCategory.mockResolvedValue(undefined)
    const result = await createCategory({ name: 'Gym', icon: 'tag', color: '#000000', kind: 'discretionary' })
    expect(result.ok).toBe(true)
    expect(mockQ.insertCategory).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Gym',
      sort_order: 1,
      user_id: 'local',
    }))
  })

  it('blocks updates and deletes for system categories', async () => {
    mockQ.getCategory.mockResolvedValue({ ...baseCategory, user_id: null })
    const update = await updateCategory({ id: categoryId, name: 'System' })
    const del = await deleteCategory(categoryId)
    expect(update.ok).toBe(false)
    expect(del.ok).toBe(false)
    if (!update.ok) expect(update.error.code).toBe('AUTH_FORBIDDEN')
    if (!del.ok) expect(del.error.code).toBe('AUTH_FORBIDDEN')
  })

  it('wipes and exports finance data', async () => {
    mockQ.wipeFinanceData.mockResolvedValue({ transactions: 2, categories: 1, rules: 0 })
    mockQ.exportFinanceData.mockResolvedValue({ transactions: [baseTx], categories: [baseCategory], rules: [] })

    const wiped = await wipeAllData()
    expect(wiped.ok).toBe(true)
    if (wiped.ok) expect(wiped.value.deleted).toBe(3)
    expect(mockEnqueue).toHaveBeenCalledWith('finance_transaction', 'ALL', 'wipe')
    expect(mockEnqueue).toHaveBeenCalledWith('finance_category', 'ALL', 'wipe')

    const exported = await exportAllData()
    expect(exported.ok).toBe(true)
    if (exported.ok) expect(JSON.parse(exported.value).transactions).toHaveLength(1)
  })

  it('identifies expenses by negative amount', () => {
    expect(isExpense({ amount_cents: -1 })).toBe(true)
    expect(isExpense({ amount_cents: 1 })).toBe(false)
  })
})
