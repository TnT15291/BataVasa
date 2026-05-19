import { ok, appErr, type Result, type AppError } from '@services/result'
import { uuid } from '@services/uuid'
import { logger } from '@services/logger'
import { nowIso } from '@db/core/db'
import * as q from '@db/reminders/queries'
import { scheduleReminderNotification, cancelNotification, cancelAllNotifications } from '@services/notifications'
import {
  CreateReminderInputSchema,
  UpdateReminderInputSchema,
  type CreateReminderInput,
  type UpdateReminderInput,
  type Reminder,
} from './types'

const MODULE = 'reminders.service'

// notificationId cache: reminderId → notificationId
const notifCache = new Map<string, string>()

export async function createReminder(
  input: CreateReminderInput
): Promise<Result<Reminder, AppError>> {
  const parsed = CreateReminderInputSchema.safeParse(input)
  if (!parsed.success) {
    return appErr('VALIDATION_FAILED', parsed.error.issues[0]?.message ?? 'Invalid input', parsed.error)
  }
  const data = parsed.data

  try {
    const reminder: Reminder = {
      id: uuid(),
      user_id: null,
      title: data.title,
      note: data.note ?? null,
      remind_at: data.remind_at,
      advance_minutes: data.advance_minutes,
      recurrence: data.recurrence,
      completed: 0,
      location_lat: data.location_lat ?? null,
      location_lng: data.location_lng ?? null,
      location_label: data.location_label ?? null,
      created_at: nowIso(),
      updated_at: nowIso(),
      deleted_at: null,
      synced_at: null,
    }
    await q.insertReminder(reminder)

    const notifId = await scheduleReminderNotification(
      reminder.id, reminder.title, reminder.note ?? '', new Date(reminder.remind_at)
    )
    if (notifId) notifCache.set(reminder.id, notifId)

    logger.info(MODULE, 'reminder created', { id: reminder.id })
    return ok(reminder)
  } catch (e) {
    logger.error(MODULE, 'createReminder failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to create reminder', e)
  }
}

export async function updateReminder(
  input: UpdateReminderInput
): Promise<Result<Reminder, AppError>> {
  const parsed = UpdateReminderInputSchema.safeParse(input)
  if (!parsed.success) {
    return appErr('VALIDATION_FAILED', parsed.error.issues[0]?.message ?? 'Invalid input', parsed.error)
  }
  const data = parsed.data

  try {
    const existing = await q.getReminder(data.id)
    if (!existing) return appErr('NOT_FOUND', 'Reminder not found')

    const patch: Partial<Reminder> = { updated_at: nowIso() }
    if (data.title !== undefined) patch.title = data.title
    if (data.note !== undefined) patch.note = data.note
    if (data.remind_at !== undefined) patch.remind_at = data.remind_at
    if (data.recurrence !== undefined) patch.recurrence = data.recurrence
    if (data.completed !== undefined) patch.completed = data.completed
    if (data.advance_minutes !== undefined) patch.advance_minutes = data.advance_minutes
    if (data.location_lat !== undefined) patch.location_lat = data.location_lat
    if (data.location_lng !== undefined) patch.location_lng = data.location_lng
    if (data.location_label !== undefined) patch.location_label = data.location_label

    await q.updateReminder(data.id, patch)

    // Re-schedule notification if time changed
    if (data.remind_at !== undefined || data.title !== undefined) {
      const oldNotifId = notifCache.get(data.id)
      if (oldNotifId) await cancelNotification(oldNotifId)
      const fresh = await q.getReminder(data.id)
      if (fresh && !fresh.completed) {
        const notifId = await scheduleReminderNotification(
          fresh.id, fresh.title, fresh.note ?? '', new Date(fresh.remind_at)
        )
        if (notifId) notifCache.set(fresh.id, notifId)
        else notifCache.delete(fresh.id)
      }
    }

    const fresh = await q.getReminder(data.id)
    if (!fresh) return appErr('INTERNAL', 'Updated reminder vanished')
    return ok(fresh)
  } catch (e) {
    logger.error(MODULE, 'updateReminder failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to update reminder', e)
  }
}

export async function deleteReminder(id: string): Promise<Result<void, AppError>> {
  try {
    const existing = await q.getReminder(id)
    if (!existing) return appErr('NOT_FOUND', 'Reminder not found')

    const notifId = notifCache.get(id)
    if (notifId) { await cancelNotification(notifId); notifCache.delete(id) }

    await q.softDeleteReminder(id, nowIso())
    logger.info(MODULE, 'reminder deleted', { id })
    return ok(undefined)
  } catch (e) {
    logger.error(MODULE, 'deleteReminder failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to delete reminder', e)
  }
}

export async function loadReminders(): Promise<Result<Reminder[], AppError>> {
  try {
    const reminders = await q.listReminders()
    return ok(reminders)
  } catch (e) {
    logger.error(MODULE, 'loadReminders failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to load reminders', e)
  }
}

export async function wipeAllReminders(): Promise<Result<{ deleted: number }, AppError>> {
  try {
    await cancelAllNotifications()
    notifCache.clear()
    const deleted = await q.wipeReminders()
    logger.info(MODULE, 'wiped all reminders', { deleted })
    return ok({ deleted })
  } catch (e) {
    logger.error(MODULE, 'wipeAllReminders failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to wipe reminders', e)
  }
}

export async function exportAllReminders(): Promise<Result<string, AppError>> {
  try {
    const reminders = await q.exportRemindersData()
    return ok(JSON.stringify({ exported_at: new Date().toISOString(), reminders }, null, 2))
  } catch (e) {
    logger.error(MODULE, 'exportAllReminders failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to export reminders', e)
  }
}
