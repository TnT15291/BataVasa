import { Platform } from 'react-native'
import { useEffect, useRef } from 'react'
import { useRouter } from 'expo-router'
import * as Notifications from 'expo-notifications'
import { WEEKLY_REVIEW_NOTIFICATION_TYPE } from '@services/proactiveNotifications'

/**
 * Route the app when the user taps a notification. Uses
 * `useLastNotificationResponse` so it handles both cold-start launches (app
 * opened from a notification) and taps while running. A per-identifier guard
 * stops the same response from re-navigating on re-render.
 */
export function useNotificationRouting(): void {
  if ((Platform.OS as string) === 'web') return

  const router = useRouter()
  const lastResponse = Notifications.useLastNotificationResponse()
  const handledId = useRef<string | null>(null)

  useEffect(() => {
    if (!lastResponse) return
    const request = lastResponse.notification.request
    if (handledId.current === request.identifier) return

    const data = request.content.data as { type?: string } | undefined
    if (data?.type === WEEKLY_REVIEW_NOTIFICATION_TYPE) {
      handledId.current = request.identifier
      router.push('/weekly-review')
    }
  }, [lastResponse, router])
}
