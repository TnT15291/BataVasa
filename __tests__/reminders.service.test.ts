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
  cancelReminderNotifications: jest.fn(),
  cancelAllNotifications: jest.fn(),
}))

import * as q from '../database/reminders/queries'
import { enqueue } from '../database/sync/queue'
import {
  createReminder,
  updateReminder,
  skipReminder,
  deleteReminder,
  loadReminders,
  wipeAllReminders,
  exportAllReminders,
} from '../features/reminders/services'
import { cancelAllNotifications, cancelReminderNotifications, scheduleReminderNotification } from '../services/notifications'
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
    expect(scheduleReminderNotification).toHaveBeenCalledWith(reminderId, 'Dentist', 'Bring card', expect.any(Date), 'medium')
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
    expect(scheduleReminderNotification).toHaveBeenCalledWith(reminderId, 'Doctor', 'Bring card', expect.any(Date), 'medium')
  })

  it('skips recurring reminder to next occurrence and reschedules', async () => {
    mockQ.getReminder
      .mockResolvedValueOnce({ ...baseReminder, recurrence: 'daily', remind_at: '2099-01-01T09:00:00.000Z' })
      .mockResolvedValueOnce({ ...baseReminder, recurrence: 'daily', remind_at: '2099-01-02T09:00:00.000Z' })
    mockQ.updateReminder.mockResolvedValue(undefined)
    ;(scheduleReminderNotification as jest.Mock).mockResolvedValue('notif-3')

    const result = await skipReminder(reminderId)

    expect(result.ok).toBe(true)
    expect(mockQ.updateReminder).toHaveBeenCalledWith(reminderId, expect.objectContaining({
      remind_at: '2099-01-02T09:00:00.000Z',
      completed: 0,
    }))
    expect(scheduleReminderNotification).toHaveBeenCalledWith(reminderId, 'Dentist', 'Bring card', expect.any(Date), 'medium')
    expect(enqueue).toHaveBeenCalledWith('reminder', reminderId, 'upsert')
  })

  it('skips one-off reminder by completing it', async () => {
    mockQ.getReminder
      .mockResolvedValueOnce(baseReminder)
      .mockResolvedValueOnce({ ...baseReminder, completed: 1 })
    mockQ.updateReminder.mockResolvedValue(undefined)

    const result = await skipReminder(reminderId)

    expect(result.ok).toBe(true)
    expect(mockQ.updateReminder).toHaveBeenCalledWith(reminderId, expect.objectContaining({ completed: 1 }))
    expect(scheduleReminderNotification).not.toHaveBeenCalled()
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

  it('deletes existing reminder and cancels pending OS notifications', async () => {
    mockQ.getReminder.mockResolvedValue(baseReminder)
    mockQ.softDeleteReminder.mockResolvedValue(undefined)
    const result = await deleteReminder(reminderId)

    expect(result.ok).toBe(true)
    expect(cancelReminderNotifications).toHaveBeenCalledWith(reminderId)
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

describe('reminders service — error paths and branches', () => {
  it('createReminder returns DB_ERROR on insert failure', async () => {
    mockQ.insertReminder.mockRejectedValue(new Error('disk full'))
    const result = await createReminder({ title: 'Test', remind_at: '2026-06-01T09:00:00.000Z', advance_minutes: 0, recurrence: 'none' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DB_ERROR')
  })

  it('createReminder skips notification for inbox item', async () => {
    mockQ.insertReminder.mockResolvedValue(undefined)
    const result = await createReminder({ title: 'Buy milk', is_inbox: 1, advance_minutes: 0, recurrence: 'none' })
    expect(result.ok).toBe(true)
    expect(scheduleReminderNotification).not.toHaveBeenCalled()
  })

  it('updateReminder returns VALIDATION_FAILED for empty id', async () => {
    const result = await updateReminder({ id: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_FAILED')
  })

  it('updateReminder returns DB_ERROR on throw', async () => {
    mockQ.getReminder.mockResolvedValue(baseReminder)
    mockQ.updateReminder.mockRejectedValue(new Error('fail'))
    const result = await updateReminder({ id: reminderId, title: 'X' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DB_ERROR')
  })

  it('updateReminder returns INTERNAL when fresh vanishes after update', async () => {
    mockQ.getReminder
      .mockResolvedValueOnce(baseReminder)
      .mockResolvedValueOnce(null)  // after notification re-schedule check
      .mockResolvedValueOnce(null)  // final fetch
    mockQ.updateReminder.mockResolvedValue(undefined)
    const result = await updateReminder({ id: reminderId, title: 'Ghost' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INTERNAL')
  })

  it('updateReminder does not reschedule when non-time fields updated', async () => {
    mockQ.getReminder
      .mockResolvedValueOnce(baseReminder)
      .mockResolvedValueOnce(baseReminder)
    mockQ.updateReminder.mockResolvedValue(undefined)
    await updateReminder({ id: reminderId, note: 'Updated note' })
    expect(scheduleReminderNotification).not.toHaveBeenCalled()
  })

  it('skipReminder returns NOT_FOUND for missing reminder', async () => {
    mockQ.getReminder.mockResolvedValue(null)
    const result = await skipReminder(reminderId)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
  })

  it('skipReminder with weekly recurrence advances by 7 days', async () => {
    const weeklyReminder = { ...baseReminder, recurrence: 'weekly' as const, remind_at: '2099-01-01T09:00:00.000Z' }
    mockQ.getReminder
      .mockResolvedValueOnce(weeklyReminder)
      .mockResolvedValueOnce({ ...weeklyReminder, remind_at: '2099-01-08T09:00:00.000Z' })
    mockQ.updateReminder.mockResolvedValue(undefined)
    const result = await skipReminder(reminderId)
    expect(result.ok).toBe(true)
    expect(mockQ.updateReminder).toHaveBeenCalledWith(reminderId, expect.objectContaining({ completed: 0 }))
  })

  it('skipReminder with monthly recurrence advances by 1 month', async () => {
    const monthlyReminder = { ...baseReminder, recurrence: 'monthly' as const, remind_at: '2099-01-15T09:00:00.000Z' }
    mockQ.getReminder
      .mockResolvedValueOnce(monthlyReminder)
      .mockResolvedValueOnce({ ...monthlyReminder, remind_at: '2099-02-15T09:00:00.000Z' })
    mockQ.updateReminder.mockResolvedValue(undefined)
    const result = await skipReminder(reminderId)
    expect(result.ok).toBe(true)
    expect(mockQ.updateReminder).toHaveBeenCalledWith(reminderId, expect.objectContaining({ completed: 0 }))
  })

  it('skipReminder does not reschedule when fresh is completed', async () => {
    mockQ.getReminder
      .mockResolvedValueOnce(baseReminder)
      .mockResolvedValueOnce({ ...baseReminder, completed: 1 })
    mockQ.updateReminder.mockResolvedValue(undefined)
    await skipReminder(reminderId)
    expect(scheduleReminderNotification).not.toHaveBeenCalled()
  })

  it('skipReminder does not reschedule when fresh is inbox', async () => {
    mockQ.getReminder
      .mockResolvedValueOnce(baseReminder)
      .mockResolvedValueOnce({ ...baseReminder, is_inbox: 1 })
    mockQ.updateReminder.mockResolvedValue(undefined)
    await skipReminder(reminderId)
    expect(scheduleReminderNotification).not.toHaveBeenCalled()
  })

  it('skipReminder returns DB_ERROR on throw', async () => {
    mockQ.getReminder.mockRejectedValue(new Error('fail'))
    const result = await skipReminder(reminderId)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DB_ERROR')
  })

  it('deleteReminder returns DB_ERROR on throw', async () => {
    mockQ.getReminder.mockResolvedValue(baseReminder)
    mockQ.softDeleteReminder.mockRejectedValue(new Error('fail'))
    const result = await deleteReminder(reminderId)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DB_ERROR')
  })

  it('wipeAllReminders returns DB_ERROR on throw', async () => {
    mockQ.wipeReminders.mockRejectedValue(new Error('fail'))
    const result = await wipeAllReminders()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DB_ERROR')
  })

  it('exportAllReminders returns DB_ERROR on throw', async () => {
    mockQ.exportRemindersData.mockRejectedValue(new Error('fail'))
    const result = await exportAllReminders()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DB_ERROR')
  })
})
