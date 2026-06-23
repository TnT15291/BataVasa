import { useEffect } from 'react'
import * as Linking from 'expo-linking'
import { useAuthStore } from '@store/authStore'
import { getTranslations } from '@services/i18n'
import { logger } from '@services/logger'
import { extractAuthParams, isPasswordRecoveryUrl } from '@services/authDeepLinks'

const MODULE = 'auth.recovery'
const handledRecoveryUrls = new Set<string>()

/**
 * Listens for `batavasa://reset-password` deep links opened from a password
 * recovery email and drives the auth store into recovery mode.
 *
 * Waits for `initialized` so the store's `onAuthStateChange` listener is already
 * registered before `enterRecovery` sets the session (otherwise the SIGNED_IN
 * reload could be missed). Mount once near the app root.
 */
export function usePasswordRecoveryLink() {
  const initialized = useAuthStore((s) => s.initialized)
  const currentUrl = Linking.useURL()

  useEffect(() => {
    if (!initialized) return
    let active = true

    async function handle(url: string | null) {
      // Only act on our recovery deep link — never hijack other incoming URLs.
      if (!active || !url || !isPasswordRecoveryUrl(url)) return
      if (handledRecoveryUrls.has(url)) return
      handledRecoveryUrls.add(url)

      const params = extractAuthParams(url)
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      const errorDescription = params.get('error_description') ?? params.get('error')

      if (accessToken && refreshToken) {
        const r = await useAuthStore.getState().enterRecovery(accessToken, refreshToken)
        if (!r.ok) logger.error(MODULE, 'enterRecovery failed for recovery link')
        return
      }
      const code = params.get('code')
      if (code) {
        const r = await useAuthStore.getState().enterRecoveryWithCode(code)
        if (!r.ok) logger.error(MODULE, 'enterRecoveryWithCode failed for recovery link')
        return
      }
      if (errorDescription) {
        // Expired or already-used link — surface a localized message on the auth screen.
        logger.warn(MODULE, 'recovery link error', { error: errorDescription })
        useAuthStore.setState({ error: getTranslations().auth_reset_link_invalid })
      }
    }

    // Cold start: the link that launched the app.
    Linking.getInitialURL()
      .then(handle)
      .catch((e) => logger.error(MODULE, 'getInitialURL failed', { error: String(e) }))
    void handle(currentUrl)

    // Warm: links arriving while the app is already running.
    const sub = Linking.addEventListener('url', ({ url }) => { void handle(url) })

    return () => {
      active = false
      sub.remove()
    }
  }, [initialized, currentUrl])
}
