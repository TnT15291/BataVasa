import { ok, appErr, type Result, type AppError } from '@services/result'
import { uuid } from '@services/uuid'
import { logger } from '@services/logger'
import { getCurrentUserId } from '@services/identity'
import { nowIso } from '@db/core/db'
import * as q from '@db/reminders/queries'
import { enqueue } from '@db/sync/queue'
import { scheduleReminderNotification, cancelReminderNotifications, cancelAllNotifications } from '@services/notifications'
import { track } from '@services/analytics'
import {
  CreateReminderInputSchema,
  UpdateReminderInputSchema,
  type CreateReminderInput,
  type UpdateReminderInput,
  type Reminder,
} from './types'

const MODULE = 'reminders.service'

function addRecurrence(date: Date, recurrence: Reminder['recurrence']): Date {
  const next = new Date(date)
  if (recurrence === 'daily') next.setDate(next.getDate() + 1)
  else if (recurrence === 'weekly') next.setDate(next.getDate() + 7)
  else if (recurrence === 'monthly') next.setMonth(next.getMonth() + 1)
  return next
}

function nextOccurrence(reminder: Reminder, after = new Date()): string | null {
  if (reminder.recurrence === 'none') return null
  const advance = reminder.advance_minutes ?? 0
  let eventAt = new Date(new Date(reminder.remind_at).getTime() + advance * 60000)
  eventAt = addRecurrence(eventAt, reminder.recurrence)
  let guard = 0
  while (eventAt <= after && guard < 370) {
    eventAt = addRecurrence(eventAt, reminder.recurrence)
    guard += 1
  }
  return new Date(eventAt.getTime() - advance * 60000).toISOString()
}

async function cancelPendingNotifications(reminderId: string): Promise<void> {
  await cancelReminderNotifications(reminderId)
}

export async function createReminder(
  input: CreateReminderInput
): Promise<Result<Reminder, AppError>> {
  const parsed = CreateReminderInputSchema.safeParse(input)
  if (!parsed.success) {
    return appErr('VALIDATION_FAILED', parsed.error.issues[0]?.message ?? 'Invalid input', parsed.error)
  }
  const data = parsed.data

  try {
    const timestamp = nowIso()
    const isInbox = data.is_inbox === 1
    const reminder: Reminder = {
      id: uuid(),
      user_id: getCurrentUserId(),
      title: data.title,
      note: data.note ?? null,
      remind_at: data.remind_at ?? timestamp,
      advance_minutes: isInbox ? 0 : data.advance_minutes,
      recurrence: isInbox ? 'none' : data.recurrence,
      priority: data.priority ?? 'medium',
      is_inbox: isInbox ? 1 : 0,
      completed: 0,
      location_lat: data.location_lat ?? null,
      location_lng: data.location_lng ?? null,
      location_label: data.location_label ?? null,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
      synced_at: null,
    }
    await q.insertReminder(reminder)

    if (!reminder.is_inbox) {
      await scheduleReminderNotification(
        reminder.id, reminder.title, reminder.note ?? '', new Date(reminder.remind_at), reminder.priority
      )
    }
    void enqueue('reminder', reminder.id, 'upsert')
    track('feature_used', { feature_name: 'reminder_created' })
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
    const existing = await q.getReminder(data.id, getCurrentUserId())
    if (!existing) return appErr('NOT_FOUND', 'Reminder not found')

    const patch: Partial<Reminder> = { updated_at: nowIso() }
    if (data.title !== undefined) patch.title = data.title
    if (data.note !== undefined) patch.note = data.note
    if (data.remind_at !== undefined) patch.remind_at = data.remind_at
    if (data.recurrence !== undefined) patch.recurrence = data.recurrence
    if (data.priority !== undefined) patch.priority = data.priority
    if (data.is_inbox !== undefined) patch.is_inbox = data.is_inbox
    if (data.completed !== undefined) patch.completed = data.completed
    if (data.advance_minutes !== undefined) patch.advance_minutes = data.advance_minutes
    if (data.location_lat !== undefined) patch.location_lat = data.location_lat
    if (data.location_lng !== undefined) patch.location_lng = data.location_lng
    if (data.location_label !== undefined) patch.location_label = data.location_label

    await q.updateReminder(data.id, patch)

    // Re-schedule notification if time changed
    if (data.remind_at !== undefined || data.title !== undefined || data.priority !== undefined || data.is_inbox !== undefined || data.completed !== undefined) {
      await cancelPendingNotifications(data.id)
      const fresh = await q.getReminder(data.id, getCurrentUserId())
      if (fresh && !fresh.completed && !fresh.is_inbox) {
        await scheduleReminderNotification(
          fresh.id, fresh.title, fresh.note ?? '', new Date(fresh.remind_at), fresh.priority
        )
      }
    }

    void enqueue('reminder', data.id, 'upsert')
    const fresh = await q.getReminder(data.id, getCurrentUserId())
    if (!fresh) return appErr('INTERNAL', 'Updated reminder vanished')
    return ok(fresh)
  } catch (e) {
    logger.error(MODULE, 'updateReminder failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to update reminder', e)
  }
}

export async function skipReminder(id: string): Promise<Result<Reminder, AppError>> {
  try {
    const existing = await q.getReminder(id, getCurrentUserId())
    if (!existing) return appErr('NOT_FOUND', 'Reminder not found')

    const nextRemindAt = nextOccurrence(existing)
    const patch: Partial<Reminder> = {
      updated_at: nowIso(),
      completed: nextRemindAt ? 0 : 1,
    }
    if (nextRemindAt) patch.remind_at = nextRemindAt

    await q.updateReminder(id, patch)
    await cancelPendingNotifications(id)

    const fresh = await q.getReminder(id, getCurrentUserId())
    if (!fresh) return appErr('INTERNAL', 'Skipped reminder vanished')
    if (!fresh.completed && !fresh.is_inbox) {
      await scheduleReminderNotification(
        fresh.id, fresh.title, fresh.note ?? '', new Date(fresh.remind_at), fresh.priority
      )
    }

    void enqueue('reminder', id, 'upsert')
    return ok(fresh)
  } catch (e) {
    logger.error(MODULE, 'skipReminder failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to skip reminder', e)
  }
}

export async function deleteReminder(id: string): Promise<Result<void, AppError>> {
  try {
    const existing = await q.getReminder(id, getCurrentUserId())
    if (!existing) return appErr('NOT_FOUND', 'Reminder not found')

    await cancelPendingNotifications(id)

    await q.softDeleteReminder(id, nowIso())
    void enqueue('reminder', id, 'upsert')
    logger.info(MODULE, 'reminder deleted', { id })
    return ok(undefined)
  } catch (e) {
    logger.error(MODULE, 'deleteReminder failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to delete reminder', e)
  }
}

export async function loadReminders(): Promise<Result<Reminder[], AppError>> {
  try {
    const reminders = await q.listReminders(getCurrentUserId())
    return ok(reminders)
  } catch (e) {
    logger.error(MODULE, 'loadReminders failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to load reminders', e)
  }
}

export async function wipeAllReminders(): Promise<Result<{ deleted: number }, AppError>> {
  try {
    await cancelAllNotifications()
    const deleted = await q.wipeReminders(getCurrentUserId())
    void enqueue('reminder', 'ALL', 'wipe')
    logger.info(MODULE, 'wiped all reminders', { deleted })
    return ok({ deleted })
  } catch (e) {
    logger.error(MODULE, 'wipeAllReminders failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to wipe reminders', e)
  }
}

export async function exportAllReminders(): Promise<Result<string, AppError>> {
  try {
    const reminders = await q.exportRemindersData(getCurrentUserId())
    return ok(JSON.stringify({ exported_at: new Date().toISOString(), reminders }, null, 2))
  } catch (e) {
    logger.error(MODULE, 'exportAllReminders failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to export reminders', e)
  }
}
