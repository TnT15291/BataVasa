import { Platform } from 'react-native'
import { logger } from './logger'
import { getTranslations } from './i18n'
import { useSettingsStore } from '@store/settingsStore'
import { requestNotificationPermission } from './notifications'
import { getCurrentUserId } from './identity'
import { listJournals } from '@db/journals/queries'

async function importNotifications() {
  try {
    return await import('expo-notifications')
  } catch (e) {
    logger.warn('notifications', 'load expo-notifications failed', { error: String(e) })
    return null
  }
}

// Data tag carried on the notification so the deep-link router (and the cancel
// sweep) can recognize a journal-anniversary nudge ("on this day, a year ago…").
export const ANNIVERSARY_NOTIFICATION_TYPE = 'journal_anniversary'
const ANNIVERSARY_CHANNEL = 'anniversaries'
// Only schedule anniversaries coming up soon. Reconciled on every app open, so
// this stays well under the OS pending-notification cap and avoids the
// YEARLY-trigger month-indexing pitfalls — DATE triggers are unambiguous.
const HORIZON_DAYS = 35
const MAX_SCHEDULED = 16
const FIRE_HOUR = 9

export type AnniversaryEntry = { id: string; occurred_at: string }
export type AnniversaryPlanItem = { journalId: string; years: number; fireAt: Date }

/**
 * Pure: the upcoming journal anniversaries worth notifying about. For each
 * entry it finds the next yearly recurrence of its date at `hour` local that is
 * (a) at least the 1-year mark and (b) within `horizonDays`. Sorted soonest
 * first, capped at `max`. A Feb-29 origin clamps to the month's last day.
 */
export function computeAnniversaryPlan(
  entries: AnniversaryEntry[],
  now: Date,
  horizonDays: number = HORIZON_DAYS,
  max: number = MAX_SCHEDULED,
  hour: number = FIRE_HOUR
): AnniversaryPlanItem[] {
  const horizonEnd = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000)
  const out: AnniversaryPlanItem[] = []
  for (const e of entries) {
    const origin = new Date(e.occurred_at)
    if (isNaN(origin.getTime())) continue
    const dateFor = (year: number): Date => {
      const lastDay = new Date(year, origin.getMonth() + 1, 0).getDate()
      return new Date(year, origin.getMonth(), Math.min(origin.getDate(), lastDay), hour, 0, 0, 0)
    }
    let fireAt = dateFor(now.getFullYear())
    if (fireAt.getTime() <= now.getTime()) fireAt = dateFor(now.getFullYear() + 1)
    const years = fireAt.getFullYear() - origin.getFullYear()
    if (years < 1) continue
    if (fireAt > horizonEnd) continue
    out.push({ journalId: e.id, years, fireAt })
  }
  out.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime())
  return out.slice(0, max)
}

// Privacy: the body never echoes journal content (notifications surface on the
// lock screen). It carries only the year count + a generic invitation to open.
// Singular/plural split so English/French read correctly ("a year" vs "N years").
export function formatAnniversaryBody(t: ReturnType<typeof getTranslations>, years: number): string {
  return years === 1
    ? t.anniversary_notif_body_one
    : t.anniversary_notif_body_many.replace('{{years}}', String(years))
}

async function ensureAnniversaryChannel(): Promise<void> {
  if (Platform.OS !== 'android') return
  const Notifications = await importNotifications()
  if (!Notifications) return
  await Notifications.setNotificationChannelAsync(ANNIVERSARY_CHANNEL, {
    name: 'Anniversaries',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
  })
}

export async function cancelAnniversaryNotifications(): Promise<void> {
  try {
    const Notifications = await importNotifications()
    if (!Notifications) return
    const scheduled = await Notifications.getAllScheduledNotificationsAsync()
    await Promise.all(
      scheduled
        .filter((n) => n.content.data?.type === ANNIVERSARY_NOTIFICATION_TYPE)
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
    )
  } catch (e) {
    logger.error('notifications', 'cancelAnniversaryNotifications failed', { error: String(e) })
  }
}

async function scheduleAnniversaryNotifications(): Promise<void> {
  await ensureAnniversaryChannel()
  // Replace any prior schedule so edits/deletes don't leave stale anniversaries.
  await cancelAnniversaryNotifications()

  const journals = await listJournals(getCurrentUserId())
  const important: AnniversaryEntry[] = journals
    .filter((j) => !j.deleted_at && (j.is_important ?? 0) === 1 && !!j.occurred_at)
    .map((j) => ({ id: j.id, occurred_at: j.occurred_at }))
  const plan = computeAnniversaryPlan(important, new Date())
  if (plan.length === 0) return

  const t = getTranslations()
  const Notifications = await importNotifications()
  if (!Notifications) return
  for (const item of plan) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: t.anniversary_notif_title,
        body: formatAnniversaryBody(t, item.years),
        data: { type: ANNIVERSARY_NOTIFICATION_TYPE, journalId: item.journalId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: item.fireAt,
        channelId: ANNIVERSARY_CHANNEL,
      },
    })
  }
}

/**
 * Reconcile journal-anniversary notifications with current settings: schedule
 * the upcoming ones when opted in (and notifications allowed + journal privacy
 * off), or cancel them otherwise. Idempotent — safe on app start/foreground.
 * Returns whether any notification is now scheduled.
 */
export async function syncAnniversaryNotifications(): Promise<boolean> {
  try {
    const s = useSettingsStore.getState()
    // Respect journal privacy: no anniversary nudges when journals are hidden.
    if (!s.anniversaryReminders || !s.notificationAccess || s.hideJournals) {
      await cancelAnniversaryNotifications()
      return false
    }
    const granted = await requestNotificationPermission()
    if (!granted) {
      await cancelAnniversaryNotifications()
      return false
    }
    await scheduleAnniversaryNotifications()
    return true
  } catch (e) {
    logger.error('notifications', 'syncAnniversaryNotifications failed', { error: String(e) })
    return false
  }
}
