const mockDb = {
  runAsync: jest.fn(),
  getAllAsync: jest.fn(),
  execAsync: jest.fn(),
}

jest.mock('@db/core/db', () => ({
  getDb: jest.fn(() => Promise.resolve(mockDb)),
  nowIso: () => '2026-01-01T00:00:00.000Z',
}))

import { dedupSystemCategories, SYSTEM_CATEGORIES, SYSTEM_CATEGORY_NAMES } from '../database/finance/schema'

beforeEach(() => {
  jest.clearAllMocks()
})

describe('dedupSystemCategories', () => {
  it('remaps references off a duplicate onto the canonical id, then deletes the duplicate', async () => {
    const food = SYSTEM_CATEGORIES.find((c) => c.name === 'Food & Groceries')!

    // 1st getAllAsync = seedSystemCategories existing-id scan: all canonical ids
    // already present, so no inserts happen.
    mockDb.getAllAsync.mockResolvedValueOnce(SYSTEM_CATEGORIES.map((c) => ({ id: c.id })))
    // Then one dup-scan per system category, in array order. Only the first
    // (Food & Groceries) has a leaked duplicate.
    mockDb.getAllAsync.mockResolvedValueOnce([{ id: 'old-random-food' }])
    for (let i = 1; i < SYSTEM_CATEGORIES.length; i++) {
      mockDb.getAllAsync.mockResolvedValueOnce([])
    }

    await dedupSystemCategories(mockDb as any)

    const calls = mockDb.runAsync.mock.calls.map((c) => [c[0], c[1]])
    // Transactions / rules / plan-items repointed onto the canonical id.
    expect(calls).toContainEqual([
      'UPDATE finance_transaction SET category_id = ? WHERE category_id = ?',
      [food.id, 'old-random-food'],
    ])
    expect(calls).toContainEqual([
      'UPDATE finance_rule SET category_id = ? WHERE category_id = ?',
      [food.id, 'old-random-food'],
    ])
    expect(calls).toContainEqual([
      'UPDATE finance_plan_item SET category_id = ? WHERE category_id = ?',
      [food.id, 'old-random-food'],
    ])
    // Duplicate row deleted.
    expect(calls).toContainEqual([
      'DELETE FROM finance_category WHERE id = ?',
      ['old-random-food'],
    ])
    // No INSERT of a duplicate canonical row (all already existed).
    expect(mockDb.runAsync.mock.calls.some((c) => String(c[0]).startsWith('INSERT INTO finance_category'))).toBe(false)
  })

  it('exposes every seed name in the leak-detection set', () => {
    expect(SYSTEM_CATEGORY_NAMES.has('Food & Groceries')).toBe(true)
    expect(SYSTEM_CATEGORY_NAMES.has('Other Income')).toBe(true)
    expect(SYSTEM_CATEGORY_NAMES.size).toBe(SYSTEM_CATEGORIES.length)
  })
})
