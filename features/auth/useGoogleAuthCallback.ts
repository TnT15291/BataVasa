import { useEffect } from 'react'
import * as Linking from 'expo-linking'
import { supabase } from '@services/supabase'
import { useAuthStore } from '@store/authStore'
import { logger } from '@services/logger'

const MODULE = 'auth.google-callback'

function parseAuthParams(url: string): URLSearchParams {
  const hashIndex = url.indexOf('#')
  if (hashIndex >= 0) return new URLSearchParams(url.slice(hashIndex + 1))
  const queryIndex = url.indexOf('?')
  if (queryIndex >= 0) return new URLSearchParams(url.slice(queryIndex + 1))
  return new URLSearchParams()
}

/**
 * Listens for `batavasa://auth/callback` deep links that arrive on Android after
 * Google OAuth. On Android, Chrome Custom Tabs cannot intercept custom-scheme
 * redirects — the URL opens the app as a new intent instead of being captured by
 * WebBrowser.openAuthSessionAsync. This hook handles the code exchange that
 * openAuthSessionAsync covers on iOS.
 *
 * Safe to mount on iOS: ASWebAuthenticationSession never fires a Linking event for
 * the redirect, so there is no double-exchange risk.
 */
export function useGoogleAuthCallback() {
  const initialized = useAuthStore((s) => s.initialized)

  useEffect(() => {
    if (!initialized || !supabase) return
    let active = true
    const client = supabase

    async function handle(url: string | null) {
      if (!active || !url || !url.includes('auth/callback')) return

      const params = parseAuthParams(url)
      const code = params.get('code')
      if (!code) return

      const { error } = await client.auth.exchangeCodeForSession(code)
      if (error) {
        logger.error(MODULE, 'exchangeCodeForSession failed', { error: error.message })
      }
    }

    Linking.getInitialURL()
      .then(handle)
      .catch((e) => logger.error(MODULE, 'getInitialURL failed', { error: String(e) }))

    const sub = Linking.addEventListener('url', ({ url }) => { void handle(url) })

    return () => {
      active = false
      sub.remove()
    }
  }, [initialized])
}
