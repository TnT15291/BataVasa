import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { logger } from './logger'

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
  const { status: existing } = await Notifications.getPermissionsAsync()
  if (existing === 'granted') return true
  const { status } = await Notifications.requestPermissionsAsync()
  return status === 'granted'
}

export async function scheduleReminderNotification(
  reminderId: string,
  title: string,
  body: string,
  triggerDate: Date
): Promise<string | null> {
  try {
    const granted = await requestNotificationPermission()
    if (!granted) return null
    if (triggerDate <= new Date()) return null

    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body, data: { reminderId } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
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

export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync()
  } catch (e) {
    logger.error('notifications', 'cancelAllNotifications failed', { error: String(e) })
  }
}
