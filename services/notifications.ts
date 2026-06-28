import { Platform } from 'react-native'
import { logger } from './logger'
import { useSettingsStore } from '@store/settingsStore'

/** User-level master switch (Settings / Privacy / Notifications). */
function notificationsEnabled(): boolean {
  return useSettingsStore.getState().notificationAccess
}

type ReminderPriority = 'low' | 'medium' | 'high'

const REMINDER_CHANNEL: Record<ReminderPriority, string> = {
  low: 'reminders-low',
  medium: 'reminders',
  high: 'reminders-important',
}

type NotificationsModule = typeof import('expo-notifications')
let notificationsModule: NotificationsModule | null | undefined = undefined

async function getNotifications(): Promise<NotificationsModule | null> {
  if (notificationsModule !== undefined) return notificationsModule
  if (Platform.OS === 'web' || (Platform.OS === 'android' && __DEV__)) {
    notificationsModule = null
    return null
  }

  try {
    const Notifications = await import('expo-notifications')
    await Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    })
    notificationsModule = Notifications
    return Notifications
  } catch (e) {
    logger.warn('notifications', 'load expo-notifications failed', { error: String(e) })
    notificationsModule = null
    return null
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false
  const Notifications = await getNotifications()
  if (!Notifications) return false
  try {
    const { status: existing } = await Notifications.getPermissionsAsync()
    if (existing === 'granted') return true
    const { status } = await Notifications.requestPermissionsAsync()
    return status === 'granted'
  } catch {
    return false
  }
}

async function ensureReminderChannels(): Promise<void> {
  if (Platform.OS !== 'android') return
  const Notifications = await getNotifications()
  if (!Notifications) return
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL.low, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.LOW,
    sound: 'default',
  })
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL.medium, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    enableVibrate: true,
  })
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL.high, {
    name: 'Important reminders',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    enableVibrate: true,
    vibrationPattern: [0, 250, 250, 250],
  })
}

export async function scheduleReminderNotification(
  reminderId: string,
  title: string,
  body: string,
  triggerDate: Date,
  priority: ReminderPriority = 'medium'
): Promise<string | null> {
  try {
    if (!notificationsEnabled()) return null
    const granted = await requestNotificationPermission()
    if (!granted) return null
    if (triggerDate <= new Date()) return null
    const Notifications = await getNotifications()
    if (!Notifications) return null
    await ensureReminderChannels()

    const notificationTitle = priority === 'high' ? `High priority: ${title}` : title
    const notificationBody = priority === 'low' ? body : body || (priority === 'high' ? 'Important reminder' : 'Reminder')
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: notificationTitle, body: notificationBody, data: { reminderId, priority } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate, channelId: REMINDER_CHANNEL[priority] },
    })
    return id
  } catch (e) {
    logger.error('notifications', 'scheduleReminderNotification failed', { error: String(e) })
    return null
  }
}

export async function cancelNotification(notificationId: string): Promise<void> {
  try {
    const Notifications = await getNotifications()
    if (!Notifications) return
    await Notifications.cancelScheduledNotificationAsync(notificationId)
  } catch (e) {
    logger.error('notifications', 'cancelNotification failed', { error: String(e) })
  }
}

export async function cancelReminderNotifications(reminderId: string): Promise<void> {
  try {
    const Notifications = await getNotifications()
    if (!Notifications) return
    const scheduled = await Notifications.getAllScheduledNotificationsAsync()
    await Promise.all(
      scheduled
        .filter((notification) => notification.content.data?.reminderId === reminderId)
        .map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier))
    )
  } catch (e) {
    logger.error('notifications', 'cancelReminderNotifications failed', { error: String(e) })
  }
}

export async function cancelAllNotifications(): Promise<void> {
  try {
    const Notifications = await getNotifications()
    if (!Notifications) return
    await Notifications.cancelAllScheduledNotificationsAsync()
  } catch (e) {
    logger.error('notifications', 'cancelAllNotifications failed', { error: String(e) })
  }
}

const HABITS_CHANNEL = 'habits'

async function ensureHabitsChannel(): Promise<void> {
  if (Platform.OS !== 'android') return
  const Notifications = await getNotifications()
  if (!Notifications) return
  await Notifications.setNotificationChannelAsync(HABITS_CHANNEL, {
    name: 'Habits',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
  })
}

export async function scheduleHabitNotifications(
  habitId: string,
  habitName: string,
  times: string[],
  body: string
): Promise<void> {
  if (times.length === 0) return
  try {
    if (!notificationsEnabled()) return
    const granted = await requestNotificationPermission()
    if (!granted) return
    const Notifications = await getNotifications()
    if (!Notifications) return
    await ensureHabitsChannel()
    for (const time of times) {
      const [hourStr, minuteStr] = time.split(':')
      const hour = parseInt(hourStr ?? '0', 10)
      const minute = parseInt(minuteStr ?? '0', 10)
      if (isNaN(hour) || isNaN(minute)) continue
      await Notifications.scheduleNotificationAsync({
        content: { title: habitName, body, data: { habitId } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
          channelId: HABITS_CHANNEL,
        },
      })
    }
  } catch (e) {
    logger.error('notifications', 'scheduleHabitNotifications failed', { error: String(e) })
  }
}

export async function cancelHabitNotifications(habitId: string): Promise<void> {
  try {
    const Notifications = await getNotifications()
    if (!Notifications) return
    const scheduled = await Notifications.getAllScheduledNotificationsAsync()
    await Promise.all(
      scheduled
        .filter((n) => n.content.data?.habitId === habitId)
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
    )
  } catch (e) {
    logger.error('notifications', 'cancelHabitNotifications failed', { error: String(e) })
  }
}
