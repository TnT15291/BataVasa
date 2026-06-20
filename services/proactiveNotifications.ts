import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { logger } from './logger'
import { getTranslations } from './i18n'
import { useSettingsStore } from '@store/settingsStore'
import { requestNotificationPermission } from './notifications'
import { buildWeeklyReviewTrigger } from './proactiveSchedule'
import { buildWeeklyTeaserBody } from './weeklyTeaser'

// Data tag carried on the notification so the deep-link router (and the
// cancel sweep) can recognize the weekly-review nudge.
export const WEEKLY_REVIEW_NOTIFICATION_TYPE = 'weekly_review'
const WEEKLY_REVIEW_CHANNEL = 'weekly-review'

async function ensureWeeklyReviewChannel(): Promise<void> {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync(WEEKLY_REVIEW_CHANNEL, {
    name: 'Weekly review',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
  })
}

export async function cancelWeeklyReviewNotification(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync()
    await Promise.all(
      scheduled
        .filter((n) => n.content.data?.type === WEEKLY_REVIEW_NOTIFICATION_TYPE)
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
    )
  } catch (e) {
    logger.error('notifications', 'cancelWeeklyReviewNotification failed', { error: String(e) })
  }
}

async function scheduleWeeklyReviewNotification(): Promise<void> {
  const s = useSettingsStore.getState()
  await ensureWeeklyReviewChannel()
  // Replace any prior schedule so day/time changes don't stack duplicates.
  await cancelWeeklyReviewNotification()

  const t = getTranslations()
  const { weekday, hour, minute } = buildWeeklyReviewTrigger(s.proactiveWeeklyDay, s.proactiveWeeklyHour)
  // Smart teaser computed now (from the latest data) is stamped onto the
  // scheduled notification; fall back to the static body when there's no data.
  const teaser = await buildWeeklyTeaserBody()
  await Notifications.scheduleNotificationAsync({
    content: {
      title: t.weekly_review_notif_title,
      body: teaser || t.weekly_review_notif_body,
      data: { type: WEEKLY_REVIEW_NOTIFICATION_TYPE },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday,
      hour,
      minute,
      channelId: WEEKLY_REVIEW_CHANNEL,
    },
  })
}

/**
 * Reconcile the scheduled weekly-review notification with current settings:
 * schedule it when opted in (and notifications are allowed + permitted), or
 * cancel it otherwise. Idempotent — safe to call on app start and on any
 * settings change. Returns whether a notification is now scheduled.
 */
export async function syncWeeklyReviewNotification(): Promise<boolean> {
  try {
    const s = useSettingsStore.getState()
    if (!s.proactiveWeeklyReview || !s.notificationAccess) {
      await cancelWeeklyReviewNotification()
      return false
    }
    const granted = await requestNotificationPermission()
    if (!granted) {
      await cancelWeeklyReviewNotification()
      return false
    }
    await scheduleWeeklyReviewNotification()
    return true
  } catch (e) {
    logger.error('notifications', 'syncWeeklyReviewNotification failed', { error: String(e) })
    return false
  }
}
