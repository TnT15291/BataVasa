const mockDb = {
  runAsync: jest.fn(),
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
}

jest.mock('../database/core/db', () => ({
  getDb: jest.fn(() => Promise.resolve(mockDb)),
}))

import {
  insertReminder,
  updateReminder,
  softDeleteReminder,
  getReminder,
  listReminders,
  wipeReminders,
  exportRemindersData,
} from '../database/reminders/queries'
import type { Reminder } from '../features/reminders/types'

const baseReminder: Reminder = {
  id: 'rem-1',
  user_id: 'user-1',
  title: 'Dentist',
  note: null,
  remind_at: '2026-01-02T09:00:00.000Z',
  advance_minutes: 15,
  recurrence: 'none',
  priority: 'medium',
  is_inbox: 0,
  completed: 0,
  location_lat: null,
  location_lng: null,
  location_label: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  synced_at: null,
}

beforeEach(() => jest.clearAllMocks())

describe('reminder queries', () => {
  it('inserts reminder with defaults', async () => {
    await insertReminder({ ...baseReminder, note: null, advance_minutes: 0 })
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO reminder'),
      expect.arrayContaining(['rem-1', 'Dentist', null, '2026-01-02T09:00:00.000Z', 0])
    )
  })

  it('updates reminder fields and no-ops empty patch', async () => {
    await updateReminder('rem-1', { title: 'Doctor', completed: 1 })
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE reminder SET title = ?, completed = ? WHERE id = ?'),
      ['Doctor', 1, 'rem-1']
    )

    mockDb.runAsync.mockClear()
    await updateReminder('rem-1', {})
    expect(mockDb.runAsync).not.toHaveBeenCalled()
  })

  it('soft-deletes, gets, lists, wipes, and exports', async () => {
    mockDb.getFirstAsync.mockResolvedValue(baseReminder)
    mockDb.getAllAsync.mockResolvedValue([baseReminder])
    mockDb.runAsync.mockResolvedValue({ changes: 3 })

    await softDeleteReminder('rem-1', '2026-01-03T00:00:00.000Z')
    await expect(getReminder('rem-1', 'user-1')).resolves.toBe(baseReminder)
    await expect(listReminders('user-1')).resolves.toEqual([baseReminder])
    await expect(wipeReminders('user-1')).resolves.toBe(3)
    await expect(exportRemindersData('user-1')).resolves.toEqual([baseReminder])

    expect(mockDb.runAsync).toHaveBeenCalledWith(expect.stringContaining('deleted_at = ?'), ['2026-01-03T00:00:00.000Z', '2026-01-03T00:00:00.000Z', 'rem-1'])
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('user_id = ?'), ['user-1'])
  })
})
