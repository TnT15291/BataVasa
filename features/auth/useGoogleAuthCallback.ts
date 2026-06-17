import { useEffect } from 'react'
import * as Linking from 'expo-linking'
import { useAuthStore } from '@store/authStore'
import { logger } from '@services/logger'

const MODULE = 'auth.google-callback'
const handledGoogleCallbackUrls = new Set<string>()

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
  const currentUrl = Linking.useURL()

  useEffect(() => {
    if (!initialized) return
    let active = true
    const completeGoogleSignIn = useAuthStore.getState().completeGoogleSignIn

    async function handle(url: string | null) {
      if (!active || !url || !url.includes('auth/callback')) return
      if (handledGoogleCallbackUrls.has(url)) return
      handledGoogleCallbackUrls.add(url)
      await completeGoogleSignIn(url)
    }

    Linking.getInitialURL()
      .then(handle)
      .catch((e) => logger.error(MODULE, 'getInitialURL failed', { error: String(e) }))
    void handle(currentUrl)

    const sub = Linking.addEventListener('url', ({ url }) => { void handle(url) })

    return () => {
      active = false
      sub.remove()
    }
  }, [initialized, currentUrl])
}
