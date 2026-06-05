import { useEffect } from 'react'
import * as Linking from 'expo-linking'
import { useAuthStore } from '@store/authStore'
import { getTranslations } from '@services/i18n'
import { logger } from '@services/logger'

const MODULE = 'auth.recovery'

/**
 * Supabase's implicit flow returns the recovery tokens in the URL **fragment**
 * (`...#access_token=…&type=recovery`), and some setups use the query string.
 * `Linking.parse` only reads the query, so pull params from whichever part the
 * link carries. `URLSearchParams` is available via `react-native-url-polyfill`
 * (loaded by services/supabase.ts).
 */
function parseAuthParams(url: string): URLSearchParams {
  const hashIndex = url.indexOf('#')
  if (hashIndex >= 0) return new URLSearchParams(url.slice(hashIndex + 1))
  const queryIndex = url.indexOf('?')
  if (queryIndex >= 0) return new URLSearchParams(url.slice(queryIndex + 1))
  return new URLSearchParams()
}

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

  useEffect(() => {
    if (!initialized) return
    let active = true

    async function handle(url: string | null) {
      // Only act on our recovery deep link — never hijack other incoming URLs.
      if (!active || !url || !url.includes('reset-password')) return

      const params = parseAuthParams(url)
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

    // Warm: links arriving while the app is already running.
    const sub = Linking.addEventListener('url', ({ url }) => { void handle(url) })

    return () => {
      active = false
      sub.remove()
    }
  }, [initialized])
}
