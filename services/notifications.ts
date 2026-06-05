import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { logger } from './logger'

type ReminderPriority = 'low' | 'medium' | 'high'

const REMINDER_CHANNEL: Record<ReminderPriority, string> = {
  low: 'reminders-low',
  medium: 'reminders',
  high: 'reminders-important',
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false
  try {
    const { status: existing } = await Notifications.getPermissionsAsync()
    if (existing === 'granted') return true
    const { status } = await Notifications.requestPermissionsAsync()
    return status === 'granted'
  } catch {
    // FCM not configured (Expo Go dev environment) — local notifications still work
    return true
  }
}

async function ensureReminderChannels(): Promise<void> {
  if (Platform.OS !== 'android') return
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
    const granted = await requestNotificationPermission()
    if (!granted) return null
    if (triggerDate <= new Date()) return null
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
    await Notifications.cancelScheduledNotificationAsync(notificationId)
  } catch (e) {
    logger.error('notifications', 'cancelNotification failed', { error: String(e) })
  }
}

export async function cancelReminderNotifications(reminderId: string): Promise<void> {
  try {
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
    await Notifications.cancelAllScheduledNotificationsAsync()
  } catch (e) {
    logger.error('notifications', 'cancelAllNotifications failed', { error: String(e) })
  }
}

const HABITS_CHANNEL = 'habits'

async function ensureHabitsChannel(): Promise<void> {
  if (Platform.OS !== 'android') return
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
    const granted = await requestNotificationPermission()
    if (!granted) return
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
