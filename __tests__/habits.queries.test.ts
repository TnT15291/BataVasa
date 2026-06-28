const mockDb = {
  runAsync: jest.fn(),
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
  withTransactionAsync: jest.fn(async (cb: () => Promise<void>) => { await cb() }),
}

jest.mock('../database/core/db', () => ({
  getDb: jest.fn(() => Promise.resolve(mockDb)),
}))

import {
  exportHabitsData,
  getHabit,
  insertHabit,
  insertHabitLog,
  listHabits,
  listLogRowsInRange,
  listLogsForHabit,
  softDeleteHabit,
  softDeleteHabitLog,
  updateHabit,
  wipeHabits,
} from '../database/habits/queries'
import type { Habit, HabitLog } from '../features/habits/types'

const baseHabit: Habit = {
  id: 'habit-1',
  user_id: 'user-1',
  name: 'Walk',
  icon: 'activity',
  color: '#22C55E',
  cadence: 'daily',
  target_per_period: 1,
  schedule_days: null,
  notification_times: null,
  identity: null,
  location_lat: null,
  location_lng: null,
  location_label: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  synced_at: null,
}

const baseLog: HabitLog = {
  id: 'log-1',
  habit_id: 'habit-1',
  user_id: 'user-1',
  occurred_at: '2026-01-02T08:00:00.000Z',
  note: null,
  skipped: 0,
  created_at: '2026-01-02T08:00:00.000Z',
  updated_at: '2026-01-02T08:00:00.000Z',
  deleted_at: null,
  synced_at: null,
}

beforeEach(() => jest.clearAllMocks())

describe('habit queries', () => {
  it('inserts, updates, and no-ops empty habit patch', async () => {
    await insertHabit(baseHabit)
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO habit'),
      expect.arrayContaining(['habit-1', 'Walk', 'daily', 1])
    )

    await updateHabit('habit-1', { name: 'Run', target_per_period: 2, id: 'ignored' } as any)
    expect(mockDb.runAsync).toHaveBeenLastCalledWith(
      expect.stringContaining('UPDATE habit SET name = ?, target_per_period = ? WHERE id = ?'),
      ['Run', 2, 'habit-1']
    )

    mockDb.runAsync.mockClear()
    await updateHabit('habit-1', { id: 'ignored' } as any)
    expect(mockDb.runAsync).not.toHaveBeenCalled()
  })

  it('soft-deletes, gets, lists, wipes, and exports habits', async () => {
    mockDb.getFirstAsync.mockResolvedValue(baseHabit)
    mockDb.getAllAsync.mockResolvedValueOnce([baseHabit]).mockResolvedValueOnce([baseHabit]).mockResolvedValueOnce([baseLog])
    mockDb.runAsync.mockResolvedValue({ changes: 4 })

    await softDeleteHabit('habit-1', '2026-01-03T00:00:00.000Z')
    await expect(getHabit('habit-1', 'user-1')).resolves.toBe(baseHabit)
    await expect(listHabits('user-1')).resolves.toEqual([baseHabit])
    await expect(wipeHabits('user-1')).resolves.toBe(4)
    await expect(exportHabitsData('user-1')).resolves.toEqual({ habits: [baseHabit], logs: [baseLog] })

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('deleted_at = ?'),
      ['2026-01-03T00:00:00.000Z', '2026-01-03T00:00:00.000Z', 'habit-1']
    )
    expect(mockDb.runAsync).toHaveBeenCalledWith('DELETE FROM habit_log WHERE user_id = ?', ['user-1'])
    expect(mockDb.runAsync).toHaveBeenCalledWith('DELETE FROM habit WHERE user_id = ?', ['user-1'])
  })

  it('inserts, soft-deletes, lists, and reads habit logs by instant range', async () => {
    const rangeRows = [{ occurred_at: '2026-01-02T08:00:00.000Z', skipped: 0 }]
    mockDb.getAllAsync.mockResolvedValueOnce([baseLog]).mockResolvedValueOnce(rangeRows)

    await insertHabitLog(baseLog)
    await softDeleteHabitLog('log-1', '2026-01-03T00:00:00.000Z')
    await expect(listLogsForHabit('habit-1')).resolves.toEqual([baseLog])
    await expect(
      listLogRowsInRange('habit-1', '2026-01-01T00:00:00.000Z', '2026-01-08T00:00:00.000Z')
    ).resolves.toEqual(rangeRows)

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO habit_log'),
      expect.arrayContaining(['log-1', 'habit-1', 'user-1'])
    )
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE habit_log SET deleted_at = ?'),
      ['2026-01-03T00:00:00.000Z', '2026-01-03T00:00:00.000Z', 'log-1']
    )
  })
})
