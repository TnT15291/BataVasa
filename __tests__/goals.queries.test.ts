const mockDb = { runAsync: jest.fn(), getFirstAsync: jest.fn(), getAllAsync: jest.fn() }
jest.mock('../database/core/db', () => ({ getDb: jest.fn(() => Promise.resolve(mockDb)) }))

import * as queries from '../database/goals/queries'
import type { Goal } from '../features/goals/types'

const goal: Goal = {
  id: 'goal-1', user_id: 'user-1', title: 'Save', description: null,
  target_type: 'amount', target_value: 100000, unit: 'VND', direction: 'reach',
  start_date: '2026-01-01', due_date: null,
  metric_binding: '{"module":"finance","aggregation":"sum_amount","category_id":"sys_salary"}',
  measures: null, status: 'active', created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z', deleted_at: null, synced_at: null,
}

beforeEach(() => jest.clearAllMocks())

describe('goal queries', () => {
  it('inserts every persisted goal field', async () => {
    await queries.insertGoal(goal)
    expect(mockDb.runAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO goal'), expect.arrayContaining(['goal-1', 'user-1', 'Save', 'reach']))
  })

  it('updates dynamic fields and ignores an id-only patch', async () => {
    await queries.updateGoal(goal.id, { title: 'Updated', status: 'paused', id: 'ignored' } as any)
    expect(mockDb.runAsync).toHaveBeenCalledWith(expect.stringContaining('title = ?, status = ?'), ['Updated', 'paused', goal.id])
    mockDb.runAsync.mockClear()
    await queries.updateGoal(goal.id, { id: 'ignored' } as any)
    expect(mockDb.runAsync).not.toHaveBeenCalled()
  })

  it('gets, lists, deletes, restores, wipes, and exports by user', async () => {
    mockDb.getFirstAsync.mockResolvedValue(goal)
    mockDb.getAllAsync.mockResolvedValue([goal])
    mockDb.runAsync.mockResolvedValue({ changes: 2 })
    await expect(queries.getGoal(goal.id, 'user-1')).resolves.toBe(goal)
    await expect(queries.getGoalIncludingDeleted(goal.id, 'user-1')).resolves.toBe(goal)
    await expect(queries.listGoals('user-1')).resolves.toEqual([goal])
    await queries.softDeleteGoal(goal.id, 'deleted-at')
    await queries.restoreGoal(goal.id, 'restored-at')
    await expect(queries.wipeGoals('user-1')).resolves.toBe(2)
    await expect(queries.exportGoalsData('user-1')).resolves.toEqual([goal])
    expect(mockDb.runAsync).toHaveBeenCalledWith('DELETE FROM goal WHERE user_id = ?', ['user-1'])
  })
})

