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
  upsertPlanItem: jest.fn(),
  listPlanItems: jest.fn(),
  getPlanItem: jest.fn(),
  getPlanItemIncludingDeleted: jest.fn(),
  updatePlanItem: jest.fn(),
  softDeletePlanItem: jest.fn(),
  restorePlanItem: jest.fn(),
  wipeFinanceData: jest.fn(),
  exportFinanceData: jest.fn(),
  getTransactionIncludingDeleted: jest.fn(),
  restoreTransaction: jest.fn(),
  insertDebt: jest.fn(),
  updateDebt: jest.fn(),
  getDebt: jest.fn(),
  getDebtIncludingDeleted: jest.fn(),
  listDebts: jest.fn(),
  softDeleteDebt: jest.fn(),
  restoreDebt: jest.fn(),
}))

jest.mock('../features/reminders/services', () => ({
  createReminder: jest.fn(),
  updateReminder: jest.fn(),
  deleteReminder: jest.fn(),
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
import * as reminderSvc from '../features/reminders/services'
import { enqueue } from '../database/sync/queue'
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  restorePlanItem,
  listTransactions,
  getTransaction,
  createCategory,
  updateCategory,
  deleteCategory,
  wipeAllData,
  exportAllData,
  calculateSafeToSpend,
  getSettledPlanItemIds,
  findMatchingPlanItem,
  linkTransactionToPlanItem,
  dismissPlanItemMatch,
  createDebt,
  settleDebt,
  deleteDebt,
  summarizeDebts,
  isExpense,
  formatAmount,
} from '../features/finance/services'
import type { Category, Debt, PlanItem, Transaction } from '../features/finance/types'

const mockQ = q as jest.Mocked<typeof q>
const mockReminderSvc = reminderSvc as jest.Mocked<typeof reminderSvc>
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
  plan_item_id: null,
  plan_match_dismissed: 0,
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
      user_id: 'user-1',
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
    mockQ.wipeFinanceData.mockResolvedValue({ transactions: 2, categories: 1, rules: 0, planItems: 0, debts: 0 })
    mockQ.exportFinanceData.mockResolvedValue({ transactions: [baseTx], categories: [baseCategory], rules: [], planItems: [], debts: [] })

    const wiped = await wipeAllData()
    expect(wiped.ok).toBe(true)
    if (wiped.ok) expect(wiped.value.deleted).toBe(3)
    expect(mockEnqueue).toHaveBeenCalledWith('finance_transaction', 'ALL', 'wipe')
    expect(mockEnqueue).toHaveBeenCalledWith('finance_plan_item', 'ALL', 'wipe')
    expect(mockEnqueue).toHaveBeenCalledWith('finance_debt', 'ALL', 'wipe')
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

describe('safe to spend', () => {
  const now = new Date('2026-01-15T12:00:00.000Z')
  const savingsCategory = { ...baseCategory, id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', kind: 'savings' as const }
  const basePlanItem: PlanItem = {
    id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21',
    user_id: 'user-1',
    name: 'Rent',
    kind: 'expense',
    amount_cents: 30000,
    currency: 'USD',
    category_id: null,
    due_day: 25,
    status: 'confirmed',
    active: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    synced_at: null,
  }
  const baseDebt: Debt = {
    id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a41',
    user_id: 'user-1',
    direction: 'borrowed',
    counterparty: 'Anh Hung',
    amount_cents: 17000,
    currency: 'USD',
    note: null,
    occurred_at: '2026-01-01T10:00:00.000Z',
    due_at: '2026-01-19T09:00:00.000Z',
    remind_days_before: 1,
    reminder_id: null,
    transaction_id: null,
    status: 'open',
    settled_at: null,
    settled_transaction_id: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    synced_at: null,
  }

  it('separates savings set-aside from spending but still subtracts it', () => {
    const result = calculateSafeToSpend({
      transactions: [
        { ...baseTx, id: 'income', amount_cents: 100000, occurred_at: '2026-01-05T12:00:00.000Z' },
        { ...baseTx, id: 'expense', amount_cents: -25000, occurred_at: '2026-01-06T12:00:00.000Z' },
        { ...baseTx, id: 'fund-allocation', category_id: savingsCategory.id, amount_cents: -20000, occurred_at: '2026-01-07T12:00:00.000Z' },
        { ...baseTx, id: 'other-expense', amount_cents: -10000, occurred_at: '2026-01-08T12:00:00.000Z' },
      ],
      categories: [baseCategory, savingsCategory],
      currency: 'USD',
      now,
    })

    expect(result.income).toBe(100000)
    expect(result.nonFundExpense).toBe(35000)
    expect(result.savingsSetAside).toBe(20000)
    expect(result.safeToSpend).toBe(45000)
  })

  it('does not count savings withdrawals as new income', () => {
    const result = calculateSafeToSpend({
      transactions: [
        { ...baseTx, id: 'withdrawal', category_id: savingsCategory.id, amount_cents: 50000, occurred_at: '2026-01-05T12:00:00.000Z' },
      ],
      categories: [baseCategory, savingsCategory],
      currency: 'USD',
      now,
    })

    expect(result.income).toBe(0)
    expect(result.safeToSpend).toBe(0)
  })

  it('keeps overdue unpaid plan items in the planned bucket', () => {
    const result = calculateSafeToSpend({
      transactions: [],
      categories: [baseCategory],
      planItems: [{ ...basePlanItem, due_day: 5 }], // due day already passed, still owed
      currency: 'USD',
      now,
    })

    expect(result.plannedExpense).toBe(30000)
  })

  it('adds debts due in the current cycle to planned buckets', () => {
    const result = calculateSafeToSpend({
      transactions: [],
      categories: [baseCategory],
      debts: [
        baseDebt,
        { ...baseDebt, id: 'lent-due', direction: 'lent', amount_cents: 9000 },
        { ...baseDebt, id: 'future-borrowed', amount_cents: 5000, due_at: '2026-02-19T09:00:00.000Z' },
      ],
      currency: 'USD',
      now,
    })

    expect(result.plannedExpense).toBe(17000)
    expect(result.plannedIncome).toBe(9000)
  })

  it('drops a plan item once a matching transaction settles it', () => {
    const result = calculateSafeToSpend({
      transactions: [
        { ...baseTx, id: 'rent-paid', merchant: 'Rent', amount_cents: -30000, occurred_at: '2026-01-10T12:00:00.000Z' },
      ],
      categories: [baseCategory],
      planItems: [basePlanItem],
      currency: 'USD',
      now,
    })

    // Counted once as recorded spending, not again as upcoming.
    expect(result.nonFundExpense).toBe(30000)
    expect(result.plannedExpense).toBe(0)
  })

  it('matches settlement by category within the 10% tolerance', () => {
    const result = calculateSafeToSpend({
      transactions: [
        { ...baseTx, id: 'rent-paid', merchant: 'Landlord LLC', amount_cents: -29000, occurred_at: '2026-01-10T12:00:00.000Z' },
      ],
      categories: [baseCategory],
      planItems: [{ ...basePlanItem, category_id: categoryId }],
      currency: 'USD',
      now,
    })

    expect(result.plannedExpense).toBe(0)
  })

  it('converts foreign-currency rows when fxRates are provided', () => {
    const result = calculateSafeToSpend({
      transactions: [
        // 250,000 VND at 25,000 VND/USD = $10.00 = 1000 cents
        { ...baseTx, id: 'vnd-expense', currency: 'VND', amount_cents: -250000, occurred_at: '2026-01-06T12:00:00.000Z' },
      ],
      categories: [baseCategory],
      currency: 'USD',
      fxRates: { USD: 1, VND: 25000 },
      now,
    })

    expect(result.nonFundExpense).toBe(1000)
  })

  it('reports a deficit instead of clamping at zero', () => {
    const result = calculateSafeToSpend({
      transactions: [
        { ...baseTx, id: 'income', amount_cents: 10000, occurred_at: '2026-01-05T12:00:00.000Z' },
        { ...baseTx, id: 'expense', amount_cents: -50000, occurred_at: '2026-01-06T12:00:00.000Z' },
      ],
      categories: [baseCategory],
      currency: 'USD',
      now,
    })

    expect(result.safeToSpend).toBe(-40000)
  })

  it('respects a custom cycle start day', () => {
    const result = calculateSafeToSpend({
      transactions: [
        // Inside the Dec 25 – Jan 25 cycle
        { ...baseTx, id: 'in-cycle', amount_cents: 100000, occurred_at: '2025-12-28T12:00:00.000Z' },
        // Before the cycle started
        { ...baseTx, id: 'before-cycle', amount_cents: 50000, occurred_at: '2025-12-20T12:00:00.000Z' },
      ],
      categories: [baseCategory],
      currency: 'USD',
      cycleStartDay: 25,
      now,
    })

    expect(result.income).toBe(100000)
  })

  it('settles a plan item via explicit link even outside the heuristic tolerance', () => {
    const result = calculateSafeToSpend({
      transactions: [
        // 20000 vs planned 30000 — far beyond ±10%, but the user confirmed the link
        { ...baseTx, id: 'partial-rent', merchant: 'Landlord', amount_cents: -20000, plan_item_id: basePlanItem.id, occurred_at: '2026-01-10T12:00:00.000Z' },
      ],
      categories: [baseCategory],
      planItems: [basePlanItem],
      currency: 'USD',
      now,
    })

    expect(result.plannedExpense).toBe(0)
  })

  it('never auto-settles with a transaction the user dismissed', () => {
    const result = calculateSafeToSpend({
      transactions: [
        // Would settle via heuristic (name + exact amount), but the user said "not that bill"
        { ...baseTx, id: 'not-rent', merchant: 'Rent', amount_cents: -30000, plan_match_dismissed: 1, occurred_at: '2026-01-10T12:00:00.000Z' },
      ],
      categories: [baseCategory],
      planItems: [basePlanItem],
      currency: 'USD',
      now,
    })

    expect(result.plannedExpense).toBe(30000)
  })

  it('returns the unspent remainder to safe-to-spend once the user confirms a match', () => {
    // Planned electricity 1,000,000 ₫ is reserved; the actual bill comes to
    // 950,000 ₫. Merchant "EVN" alone would not settle it (no heuristic
    // match), so without the link the bill double-counts. Confirming settles
    // the item: vs the pre-payment state the 50,000 ₫ remainder is freed.
    const electricPlan: PlanItem = { ...basePlanItem, name: 'Tiền điện', amount_cents: 1_000_000, currency: 'VND' }
    const salary = { ...baseTx, id: 'salary', currency: 'VND', amount_cents: 5_000_000, occurred_at: '2026-01-05T12:00:00.000Z' }
    const bill = { ...baseTx, id: 'electric-bill', currency: 'VND', amount_cents: -950_000, merchant: 'EVN', occurred_at: '2026-01-10T12:00:00.000Z' }

    const reserved = calculateSafeToSpend({
      transactions: [salary],
      categories: [baseCategory],
      planItems: [electricPlan],
      currency: 'VND',
      now,
    })
    expect(reserved.safeToSpend).toBe(5_000_000 - 1_000_000)

    const unlinked = calculateSafeToSpend({
      transactions: [salary, bill],
      categories: [baseCategory],
      planItems: [electricPlan],
      currency: 'VND',
      now,
    })
    expect(unlinked.safeToSpend).toBe(5_000_000 - 950_000 - 1_000_000)

    const confirmed = calculateSafeToSpend({
      transactions: [salary, { ...bill, plan_item_id: electricPlan.id }],
      categories: [baseCategory],
      planItems: [electricPlan],
      currency: 'VND',
      now,
    })
    expect(confirmed.plannedExpense).toBe(0)
    expect(confirmed.safeToSpend).toBe(5_000_000 - 950_000)
    expect(confirmed.safeToSpend - reserved.safeToSpend).toBe(50_000)
  })
})

describe('plan item match detection', () => {
  const now = new Date('2026-01-15T12:00:00.000Z')
  const electricPlan: PlanItem = {
    id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    user_id: 'user-1',
    name: 'Tiền điện',
    kind: 'expense',
    amount_cents: 1_000_000,
    currency: 'VND',
    category_id: null,
    due_day: 20,
    status: 'confirmed',
    active: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    synced_at: null,
  }
  const paidElectric: Transaction = {
    ...baseTx,
    id: 'tx-electric',
    currency: 'VND',
    amount_cents: -950_000,
    merchant: 'tiền điện EVN',
    occurred_at: '2026-01-14T09:00:00.000Z',
  }

  it('suggests a plan item when name and amount are similar', () => {
    const match = findMatchingPlanItem({
      transaction: paidElectric,
      planItems: [electricPlan],
      transactions: [paidElectric],
      now,
    })
    expect(match?.id).toBe(electricPlan.id)
  })

  it('does not suggest when the amount is too far off', () => {
    const tx = { ...paidElectric, amount_cents: -400_000 }
    expect(findMatchingPlanItem({ transaction: tx, planItems: [electricPlan], transactions: [tx], now })).toBeNull()
  })

  it('does not re-suggest after the user dismissed the match', () => {
    const tx = { ...paidElectric, plan_match_dismissed: 1 }
    expect(findMatchingPlanItem({ transaction: tx, planItems: [electricPlan], transactions: [tx], now })).toBeNull()
  })

  it('does not suggest an item already settled by another transaction', () => {
    const first = { ...paidElectric, id: 'first-bill', plan_item_id: electricPlan.id }
    const second = { ...paidElectric, id: 'second-bill' }
    expect(
      findMatchingPlanItem({ transaction: second, planItems: [electricPlan], transactions: [first, second], now })
    ).toBeNull()
  })

  it('ignores transactions outside the current cycle', () => {
    const tx = { ...paidElectric, occurred_at: '2025-12-10T09:00:00.000Z' }
    expect(findMatchingPlanItem({ transaction: tx, planItems: [electricPlan], transactions: [tx], now })).toBeNull()
  })

  it('prefers a name match over a category-only match', () => {
    const categoryPlan: PlanItem = {
      ...electricPlan,
      id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a23',
      name: 'Hóa đơn',
      category_id: categoryId,
      amount_cents: 950_000,
    }
    const match = findMatchingPlanItem({
      transaction: paidElectric,
      planItems: [categoryPlan, electricPlan],
      transactions: [paidElectric],
      now,
    })
    expect(match?.id).toBe(electricPlan.id)
  })
})

describe('plan item link services', () => {
  const planItem: PlanItem = {
    id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21',
    user_id: 'user-1',
    name: 'Rent',
    kind: 'expense',
    amount_cents: 30000,
    currency: 'USD',
    category_id: null,
    due_day: 25,
    status: 'confirmed',
    active: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    synced_at: null,
  }

  it('links a transaction to a plan item and queues sync', async () => {
    mockQ.getTransaction
      .mockResolvedValueOnce(baseTx)
      .mockResolvedValueOnce({ ...baseTx, plan_item_id: planItem.id })
    mockQ.getPlanItem.mockResolvedValue(planItem)
    mockQ.updateTransaction.mockResolvedValue(undefined)

    const r = await linkTransactionToPlanItem(baseTx.id, planItem.id)
    expect(r.ok).toBe(true)
    expect(mockQ.updateTransaction).toHaveBeenCalledWith(
      baseTx.id,
      expect.objectContaining({ plan_item_id: planItem.id, plan_match_dismissed: 0 })
    )
    expect(mockEnqueue).toHaveBeenCalledWith('finance_transaction', baseTx.id, 'upsert')
  })

  it('refuses to link to a missing plan item', async () => {
    mockQ.getTransaction.mockResolvedValue(baseTx)
    mockQ.getPlanItem.mockResolvedValue(null)

    const r = await linkTransactionToPlanItem(baseTx.id, planItem.id)
    expect(r.ok).toBe(false)
    expect(mockQ.updateTransaction).not.toHaveBeenCalled()
  })

  it('records a dismissal so the heuristic stays quiet', async () => {
    mockQ.getTransaction
      .mockResolvedValueOnce(baseTx)
      .mockResolvedValueOnce({ ...baseTx, plan_match_dismissed: 1 })
    mockQ.updateTransaction.mockResolvedValue(undefined)

    const r = await dismissPlanItemMatch(baseTx.id)
    expect(r.ok).toBe(true)
    expect(mockQ.updateTransaction).toHaveBeenCalledWith(
      baseTx.id,
      expect.objectContaining({ plan_item_id: null, plan_match_dismissed: 1 })
    )
    expect(mockEnqueue).toHaveBeenCalledWith('finance_transaction', baseTx.id, 'upsert')
  })
})

describe('finance plan item recovery', () => {
  const basePlanItem: PlanItem = {
    id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21',
    user_id: 'user-1',
    name: 'Rent',
    kind: 'expense',
    amount_cents: 30000,
    currency: 'USD',
    category_id: null,
    due_day: 25,
    status: 'confirmed',
    active: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: '2026-01-01T00:05:00.000Z',
    synced_at: null,
  }

  it('restores a soft-deleted plan item and queues sync', async () => {
    mockQ.getPlanItemIncludingDeleted.mockResolvedValue(basePlanItem)
    mockQ.restorePlanItem.mockResolvedValue(undefined)
    mockQ.getPlanItem.mockResolvedValue({ ...basePlanItem, deleted_at: null })

    const result = await restorePlanItem(basePlanItem.id)

    expect(result.ok).toBe(true)
    expect(mockQ.restorePlanItem).toHaveBeenCalledWith(basePlanItem.id, expect.any(String))
    expect(mockEnqueue).toHaveBeenCalledWith('finance_plan_item', basePlanItem.id, 'upsert')
  })
})

describe('finance service error paths', () => {
  it('createTransaction returns DB_ERROR on insert failure', async () => {
    mockQ.findDuplicateTransaction.mockResolvedValue(null)
    mockQ.insertTransaction.mockRejectedValue(new Error('disk full'))
    const result = await createTransaction({ amount_cents: -5000, currency: 'USD', category_id: categoryId, occurred_at: '2026-01-01T10:00:00.000Z', source: 'manual' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DB_ERROR')
  })

  it('createTransaction learns merchant rule for manual source', async () => {
    mockQ.findDuplicateTransaction.mockResolvedValue(null)
    mockQ.insertTransaction.mockResolvedValue(undefined)
    mockQ.findRuleForMerchant.mockResolvedValue(null)
    mockQ.findRuleByPattern.mockResolvedValue(null)
    mockQ.upsertTransactionRule.mockResolvedValue(undefined)
    const result = await createTransaction({ amount_cents: -5000, currency: 'USD', category_id: categoryId, merchant: 'Starbucks', occurred_at: '2026-01-01T10:00:00.000Z', source: 'manual' })
    expect(result.ok).toBe(true)
  })

  it('createTransaction silently continues when learnMerchantRule throws', async () => {
    mockQ.findDuplicateTransaction.mockResolvedValue(null)
    mockQ.insertTransaction.mockResolvedValue(undefined)
    mockQ.findRuleForMerchant.mockRejectedValue(new Error('rule db error'))
    const result = await createTransaction({ amount_cents: -5000, currency: 'USD', category_id: categoryId, merchant: 'Cafe', occurred_at: '2026-01-01T10:00:00.000Z', source: 'manual' })
    expect(result.ok).toBe(true)
  })

  it('getTransaction returns NOT_FOUND', async () => {
    mockQ.getTransaction.mockResolvedValue(null)
    const result = await getTransaction('nope')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
  })

  it('getTransaction returns DB_ERROR on throw', async () => {
    mockQ.getTransaction.mockRejectedValue(new Error('db error'))
    const result = await getTransaction('tx-id')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DB_ERROR')
  })

  it('getTransaction returns row when found', async () => {
    mockQ.getTransaction.mockResolvedValue(baseTx)
    const result = await getTransaction(transactionId)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.id).toBe(transactionId)
  })

  it('updateTransaction returns VALIDATION_FAILED for empty id', async () => {
    const result = await updateTransaction({ id: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_FAILED')
  })

  it('updateTransaction learns rule when needs_review cleared', async () => {
    const reviewed = { ...baseTx, needs_review: 0, merchant: 'Cafe' }
    mockQ.getTransaction.mockResolvedValueOnce(baseTx).mockResolvedValueOnce(reviewed)
    mockQ.updateTransaction.mockResolvedValue(undefined)
    mockQ.findRuleForMerchant.mockResolvedValue(null)
    mockQ.findRuleByPattern.mockResolvedValue(null)
    mockQ.upsertTransactionRule.mockResolvedValue(undefined)
    const result = await updateTransaction({ id: transactionId, needs_review: 0 })
    expect(result.ok).toBe(true)
  })

  it('updateTransaction returns DB_ERROR on throw', async () => {
    mockQ.getTransaction.mockResolvedValue(baseTx)
    mockQ.updateTransaction.mockRejectedValue(new Error('fail'))
    const result = await updateTransaction({ id: transactionId, amount_cents: -1000 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DB_ERROR')
  })

  it('deleteTransaction returns DB_ERROR on throw', async () => {
    mockQ.getTransaction.mockResolvedValue(baseTx)
    mockQ.softDeleteTransaction.mockRejectedValue(new Error('fail'))
    const result = await deleteTransaction(transactionId)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DB_ERROR')
  })

  it('listTransactions returns DB_ERROR on throw', async () => {
    mockQ.listTransactions.mockRejectedValue(new Error('fail'))
    const result = await listTransactions()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DB_ERROR')
  })

  it('createCategory returns VALIDATION_FAILED for empty name', async () => {
    const result = await createCategory({ name: '', icon: 'tag', color: '#22C55E', kind: 'essential' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_FAILED')
  })

  it('createCategory returns DB_ERROR on throw', async () => {
    mockQ.listCategories.mockResolvedValue([])
    mockQ.insertCategory.mockRejectedValue(new Error('fail'))
    const result = await createCategory({ name: 'Food', icon: 'tag', color: '#22C55E', kind: 'essential' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DB_ERROR')
  })

  it('updateCategory returns VALIDATION_FAILED for empty id', async () => {
    const result = await updateCategory({ id: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_FAILED')
  })

  it('updateCategory returns AUTH_FORBIDDEN for system category', async () => {
    mockQ.getCategory.mockResolvedValue({ ...baseCategory, user_id: null })
    const result = await updateCategory({ id: categoryId, name: 'New name' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('AUTH_FORBIDDEN')
  })

  it('updateCategory returns DB_ERROR on throw', async () => {
    mockQ.getCategory.mockResolvedValue(baseCategory)
    mockQ.updateCategory.mockRejectedValue(new Error('fail'))
    const result = await updateCategory({ id: categoryId, name: 'X' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DB_ERROR')
  })

  it('deleteCategory returns AUTH_FORBIDDEN for system category', async () => {
    mockQ.getCategory.mockResolvedValue({ ...baseCategory, user_id: null })
    const result = await deleteCategory(categoryId)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('AUTH_FORBIDDEN')
  })

  it('deleteCategory returns DB_ERROR on throw', async () => {
    mockQ.getCategory.mockResolvedValue(baseCategory)
    mockQ.softDeleteCategory.mockRejectedValue(new Error('fail'))
    const result = await deleteCategory(categoryId)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DB_ERROR')
  })

  it('wipeAllData returns DB_ERROR on throw', async () => {
    mockQ.wipeFinanceData.mockRejectedValue(new Error('fail'))
    const result = await wipeAllData()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DB_ERROR')
  })

  it('exportAllData returns DB_ERROR on throw', async () => {
    mockQ.exportFinanceData.mockRejectedValue(new Error('fail'))
    const result = await exportAllData()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DB_ERROR')
  })
})

describe('formatAmount', () => {
  it('formats VND as integer with ₫ symbol', () => {
    const result = formatAmount(50000, 'VND', 'vi')
    expect(result).toContain('₫')
    expect(result).toContain('50')
  })

  it('formats JPY as integer', () => {
    const result = formatAmount(1000, 'JPY', 'ja')
    expect(result).toMatch(/1[,.]?000|¥/)
  })

  it('formats KRW as integer', () => {
    const result = formatAmount(5000, 'KRW', 'ko')
    expect(result).toContain('5')
  })

  it('formats USD with 2 decimal places', () => {
    const result = formatAmount(1234, 'USD', 'en')
    expect(result).toContain('12.34')
  })

  it('formats EUR', () => {
    const result = formatAmount(999, 'EUR', 'fr')
    expect(result).toMatch(/9[,.]99/)
  })
})

describe('settled plan item detection (paid status)', () => {
  const now = new Date('2026-01-15T12:00:00.000Z')
  const planItem: PlanItem = {
    id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a21',
    user_id: 'user-1',
    name: 'Rent',
    kind: 'expense',
    amount_cents: 30000,
    currency: 'USD',
    category_id: null,
    due_day: 25,
    status: 'confirmed',
    active: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    synced_at: null,
  }
  const otherItem: PlanItem = { ...planItem, id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', name: 'Netflix', amount_cents: 1500 }

  it('marks an item paid when a linked transaction exists this cycle', () => {
    const settled = getSettledPlanItemIds({
      planItems: [planItem, otherItem],
      transactions: [
        { ...baseTx, id: 'rent-paid', amount_cents: -30000, plan_item_id: planItem.id, occurred_at: '2026-01-10T12:00:00.000Z' },
      ],
      now,
    })
    expect(settled.has(planItem.id)).toBe(true)
    expect(settled.has(otherItem.id)).toBe(false)
  })

  it('marks an item paid via the name/amount heuristic', () => {
    const settled = getSettledPlanItemIds({
      planItems: [planItem],
      transactions: [
        { ...baseTx, id: 'rent-paid', merchant: 'Rent', amount_cents: -30000, occurred_at: '2026-01-10T12:00:00.000Z' },
      ],
      now,
    })
    expect(settled.has(planItem.id)).toBe(true)
  })

  it('ignores transactions outside the current cycle', () => {
    const settled = getSettledPlanItemIds({
      planItems: [planItem],
      transactions: [
        { ...baseTx, id: 'old-rent', merchant: 'Rent', amount_cents: -30000, plan_item_id: planItem.id, occurred_at: '2025-12-10T12:00:00.000Z' },
      ],
      now,
    })
    expect(settled.has(planItem.id)).toBe(false)
  })
})

describe('debt book (sổ nợ)', () => {
  const lendingCategory: Category = { ...baseCategory, id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a31', user_id: null, name: 'Lending', kind: 'essential' }
  const borrowingCategory: Category = { ...baseCategory, id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a32', user_id: null, name: 'Borrowing', kind: 'income' }

  const baseDebt: Debt = {
    id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a41',
    user_id: 'user-1',
    direction: 'lent',
    counterparty: 'Anh Minh',
    amount_cents: 500000,
    currency: 'USD',
    note: null,
    occurred_at: '2026-01-01T10:00:00.000Z',
    due_at: '2026-02-01T09:00:00.000Z',
    remind_days_before: 3,
    reminder_id: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a51',
    transaction_id: transactionId,
    status: 'open',
    settled_at: null,
    settled_transaction_id: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    synced_at: null,
  }

  it('createDebt records an expense for lent money and schedules the due reminder', async () => {
    mockQ.listCategories.mockResolvedValue([baseCategory, lendingCategory, borrowingCategory])
    mockQ.findDuplicateTransaction.mockResolvedValue(null)
    mockQ.insertTransaction.mockResolvedValue(undefined)
    mockQ.insertDebt.mockResolvedValue(undefined)
    mockReminderSvc.createReminder.mockResolvedValue({ ok: true, value: { id: 'rem-1' } } as any)

    const result = await createDebt({
      direction: 'lent',
      counterparty: 'Anh Minh',
      amount_cents: 500000,
      currency: 'USD',
      occurred_at: '2026-01-01T10:00:00.000Z',
      due_at: '2026-02-01T09:00:00.000Z',
      remind_days_before: 3,
    }, { reminderTitle: 'Thu nợ: Anh Minh' })

    expect(result.ok).toBe(true)
    // Lent money is an expense against the Lending category.
    expect(mockQ.insertTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ amount_cents: -500000, category_id: lendingCategory.id, merchant: 'Anh Minh' })
    )
    // Notification fires remind_days_before ahead; event = due date.
    expect(mockReminderSvc.createReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Thu nợ: Anh Minh',
        remind_at: '2026-01-29T09:00:00.000Z',
        advance_minutes: 3 * 24 * 60,
        priority: 'high',
      })
    )
    expect(mockQ.insertDebt).toHaveBeenCalledWith(
      expect.objectContaining({ direction: 'lent', status: 'open', reminder_id: 'rem-1', transaction_id: transactionId })
    )
    expect(mockEnqueue).toHaveBeenCalledWith('finance_debt', expect.any(String), 'upsert')
  })

  it('createDebt records income for borrowed money and still saves when the reminder fails', async () => {
    mockQ.listCategories.mockResolvedValue([lendingCategory, borrowingCategory])
    mockQ.findDuplicateTransaction.mockResolvedValue(null)
    mockQ.insertTransaction.mockResolvedValue(undefined)
    mockQ.insertDebt.mockResolvedValue(undefined)
    mockReminderSvc.createReminder.mockResolvedValue({ ok: false, error: { code: 'DB_ERROR', message: 'boom' } } as any)

    const result = await createDebt({
      direction: 'borrowed',
      counterparty: 'Chị Lan',
      amount_cents: 200000,
      currency: 'USD',
      occurred_at: '2026-01-01T10:00:00.000Z',
      due_at: '2026-02-01T09:00:00.000Z',
      remind_days_before: 1,
    })

    expect(result.ok).toBe(true)
    expect(mockQ.insertTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ amount_cents: 200000, category_id: borrowingCategory.id })
    )
    expect(mockQ.insertDebt).toHaveBeenCalledWith(expect.objectContaining({ reminder_id: null }))
  })

  it('settleDebt records the opposite transaction, completes the reminder, and closes the debt', async () => {
    mockQ.getDebt
      .mockResolvedValueOnce(baseDebt)
      .mockResolvedValueOnce({ ...baseDebt, status: 'settled', settled_at: '2026-01-20T00:00:00.000Z' })
    mockQ.listCategories.mockResolvedValue([lendingCategory, borrowingCategory])
    mockQ.findDuplicateTransaction.mockResolvedValue(null)
    mockQ.insertTransaction.mockResolvedValue(undefined)
    mockQ.updateDebt.mockResolvedValue(undefined)
    mockReminderSvc.updateReminder.mockResolvedValue({ ok: true, value: {} } as any)

    const result = await settleDebt(baseDebt.id, { settleNote: 'Thu nợ từ Anh Minh' })

    expect(result.ok).toBe(true)
    // Collecting a lent debt is income via the Borrowing category.
    expect(mockQ.insertTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ amount_cents: 500000, category_id: borrowingCategory.id, note: 'Thu nợ từ Anh Minh' })
    )
    expect(mockReminderSvc.updateReminder).toHaveBeenCalledWith({ id: baseDebt.reminder_id, completed: 1 })
    expect(mockQ.updateDebt).toHaveBeenCalledWith(
      baseDebt.id,
      expect.objectContaining({ status: 'settled', settled_transaction_id: expect.any(String) })
    )
  })

  it('settleDebt rejects an already-settled debt', async () => {
    mockQ.getDebt.mockResolvedValue({ ...baseDebt, status: 'settled' })
    const result = await settleDebt(baseDebt.id)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_FAILED')
    expect(mockQ.insertTransaction).not.toHaveBeenCalled()
  })

  it('deleteDebt soft-deletes the debt, its transactions, and the reminder', async () => {
    mockQ.getDebt.mockResolvedValue(baseDebt)
    mockQ.softDeleteDebt.mockResolvedValue(undefined)
    mockQ.getTransaction.mockResolvedValue(baseTx)
    mockQ.softDeleteTransaction.mockResolvedValue(undefined)
    mockReminderSvc.deleteReminder.mockResolvedValue({ ok: true, value: undefined } as any)

    const result = await deleteDebt(baseDebt.id)

    expect(result.ok).toBe(true)
    expect(mockQ.softDeleteDebt).toHaveBeenCalledWith(baseDebt.id, expect.any(String))
    expect(mockQ.softDeleteTransaction).toHaveBeenCalledWith(baseDebt.transaction_id, expect.any(String))
    expect(mockReminderSvc.deleteReminder).toHaveBeenCalledWith(baseDebt.reminder_id)
  })

  it('summarizeDebts totals open debts per direction and counts overdue', () => {
    const debts: Debt[] = [
      baseDebt, // open lent 500000, overdue (due 2026-02-01 < today)
      { ...baseDebt, id: 'd2', direction: 'borrowed', amount_cents: 200000, due_at: '2999-01-01T00:00:00.000Z' },
      { ...baseDebt, id: 'd3', status: 'settled' }, // settled — excluded
      { ...baseDebt, id: 'd4', currency: 'VND', amount_cents: 999 }, // other currency — counted open, not totaled
    ]
    const summary = summarizeDebts(debts, 'USD')
    expect(summary.lentOutstanding).toBe(500000)
    expect(summary.borrowedOutstanding).toBe(200000)
    expect(summary.openCount).toBe(3)
    expect(summary.overdueCount).toBe(2)
  })
})
