import { Platform } from 'react-native'
import { useEffect, useRef, type MutableRefObject } from 'react'
import { useRouter } from 'expo-router'
import { WEEKLY_REVIEW_NOTIFICATION_TYPE } from '@services/proactiveNotifications'
import { ANNIVERSARY_NOTIFICATION_TYPE } from '@services/anniversaryNotifications'

const shouldUseNotificationRouting = Platform.OS !== 'web' && !(Platform.OS === 'android' && __DEV__)

function handleNotificationResponse(response: any, router: ReturnType<typeof useRouter>, handledId: MutableRefObject<string | null>) {
  if (!response) return
  const request = response.notification.request
  if (handledId.current === request.identifier) return
  const data = request.content.data as { type?: string; journalId?: string } | undefined
  if (data?.type === WEEKLY_REVIEW_NOTIFICATION_TYPE) {
    handledId.current = request.identifier
    router.push('/weekly-review')
  } else if (data?.type === ANNIVERSARY_NOTIFICATION_TYPE) {
    handledId.current = request.identifier
    router.push(data.journalId ? { pathname: '/journal', params: { id: data.journalId } } : '/journals')
  }
}

export function useNotificationRouting(): void {
  const router = useRouter()
  const handledId = useRef<string | null>(null)

  useEffect(() => {
    if (!shouldUseNotificationRouting) return

    let subscription: { remove: () => void } | null = null
    let mounted = true

    const setup = async () => {
      try {
        const Notifications = await import('expo-notifications')
        if (!mounted) return
        subscription = Notifications.addNotificationResponseReceivedListener((response) => {
          handleNotificationResponse(response, router, handledId)
        })
        const lastResponse = await Notifications.getLastNotificationResponseAsync()
        if (mounted) handleNotificationResponse(lastResponse, router, handledId)
      } catch {
        // Notifications are not available in this runtime.
      }
    }

    void setup()
    return () => {
      mounted = false
      subscription?.remove()
    }
  }, [router])
}
