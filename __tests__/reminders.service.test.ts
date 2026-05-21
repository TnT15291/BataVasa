jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }))

jest.mock('../database/reminders/queries', () => ({
  insertReminder: jest.fn(),
  updateReminder: jest.fn(),
  getReminder: jest.fn(),
  softDeleteReminder: jest.fn(),
  listReminders: jest.fn(),
  wipeReminders: jest.fn(),
  exportRemindersData: jest.fn(),
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
jest.mock('../services/notifications', () => ({
  scheduleReminderNotification: jest.fn(),
  cancelNotification: jest.fn(),
  cancelAllNotifications: jest.fn(),
}))

import * as q from '../database/reminders/queries'
import { enqueue } from '../database/sync/queue'
import {
  createReminder,
  updateReminder,
  deleteReminder,
  loadReminders,
  wipeAllReminders,
  exportAllReminders,
} from '../features/reminders/services'
import { cancelAllNotifications, cancelNotification, scheduleReminderNotification } from '../services/notifications'
import type { Reminder } from '../features/reminders/types'

const mockQ = q as jest.Mocked<typeof q>
const reminderId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

const baseReminder: Reminder = {
  id: reminderId,
  user_id: 'user-1',
  title: 'Dentist',
  note: 'Bring card',
  remind_at: '2026-01-02T09:00:00.000Z',
  advance_minutes: 30,
  recurrence: 'none',
  completed: 0,
  location_lat: null,
  location_lng: null,
  location_label: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  synced_at: null,
}

beforeEach(() => jest.resetAllMocks())

describe('reminders service', () => {
  it('creates reminder, schedules notification, and enqueues sync', async () => {
    mockQ.insertReminder.mockResolvedValue(undefined)
    ;(scheduleReminderNotification as jest.Mock).mockResolvedValue('notif-1')

    const result = await createReminder({
      title: 'Dentist',
      note: 'Bring card',
      remind_at: '2026-01-02T09:00:00.000Z',
      advance_minutes: 30,
      recurrence: 'none',
    })

    expect(result.ok).toBe(true)
    expect(mockQ.insertReminder).toHaveBeenCalledWith(expect.objectContaining({
      id: reminderId,
      user_id: 'user-1',
      title: 'Dentist',
      advance_minutes: 30,
      completed: 0,
    }))
    expect(scheduleReminderNotification).toHaveBeenCalledWith(reminderId, 'Dentist', 'Bring card', expect.any(Date))
    expect(enqueue).toHaveBeenCalledWith('reminder', reminderId, 'upsert')
  })

  it('rejects invalid reminder input', async () => {
    const result = await createReminder({ title: '', remind_at: 'not-date', advance_minutes: 0, recurrence: 'none' as any })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_FAILED')
  })

  it('updates and reschedules when title or time changes', async () => {
    mockQ.getReminder
      .mockResolvedValueOnce(baseReminder)
      .mockResolvedValueOnce({ ...baseReminder, title: 'Doctor' })
      .mockResolvedValueOnce({ ...baseReminder, title: 'Doctor' })
    mockQ.updateReminder.mockResolvedValue(undefined)
    ;(scheduleReminderNotification as jest.Mock).mockResolvedValue('notif-2')

    const result = await updateReminder({ id: reminderId, title: 'Doctor' })

    expect(result.ok).toBe(true)
    expect(mockQ.updateReminder).toHaveBeenCalledWith(reminderId, expect.objectContaining({ title: 'Doctor' }))
    expect(scheduleReminderNotification).toHaveBeenCalledWith(reminderId, 'Doctor', 'Bring card', expect.any(Date))
  })

  it('returns NOT_FOUND when updating or deleting missing reminder', async () => {
    mockQ.getReminder.mockResolvedValue(null)
    const updated = await updateReminder({ id: reminderId, title: 'Nope' })
    const deleted = await deleteReminder(reminderId)
    expect(updated.ok).toBe(false)
    expect(deleted.ok).toBe(false)
    if (!updated.ok) expect(updated.error.code).toBe('NOT_FOUND')
    if (!deleted.ok) expect(deleted.error.code).toBe('NOT_FOUND')
  })

  it('deletes existing reminder and cancels cached notification when present', async () => {
    mockQ.insertReminder.mockResolvedValue(undefined)
    ;(scheduleReminderNotification as jest.Mock).mockResolvedValue('notif-1')
    await createReminder({ title: 'Dentist', remind_at: '2026-01-02T09:00:00.000Z', advance_minutes: 0, recurrence: 'none' })

    mockQ.getReminder.mockResolvedValue(baseReminder)
    mockQ.softDeleteReminder.mockResolvedValue(undefined)
    const result = await deleteReminder(reminderId)

    expect(result.ok).toBe(true)
    expect(cancelNotification).toHaveBeenCalledWith('notif-1')
    expect(mockQ.softDeleteReminder).toHaveBeenCalledWith(reminderId, expect.any(String))
  })

  it('loads, wipes, and exports reminders', async () => {
    mockQ.listReminders.mockResolvedValue([baseReminder])
    mockQ.wipeReminders.mockResolvedValue(4)
    mockQ.exportRemindersData.mockResolvedValue([baseReminder])

    expect((await loadReminders()).ok).toBe(true)
    const wiped = await wipeAllReminders()
    expect(wiped.ok).toBe(true)
    expect(cancelAllNotifications).toHaveBeenCalled()
    expect(enqueue).toHaveBeenCalledWith('reminder', 'ALL', 'wipe')

    const exported = await exportAllReminders()
    expect(exported.ok).toBe(true)
    if (exported.ok) expect(JSON.parse(exported.value).reminders).toHaveLength(1)
  })

  it('maps query exceptions to DB_ERROR', async () => {
    mockQ.listReminders.mockRejectedValue(new Error('db locked'))
    const result = await loadReminders()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DB_ERROR')
  })
})
