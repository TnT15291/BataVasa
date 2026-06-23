import { Platform } from 'react-native'
import * as Linking from 'expo-linking'

export const GOOGLE_AUTH_CALLBACK_URL = 'batavasa://auth/callback'
export const PASSWORD_RECOVERY_URL = 'batavasa://reset-password'

export function getGoogleAuthRedirectTo(): string {
  return Platform.OS === 'web' ? Linking.createURL('auth/callback') : GOOGLE_AUTH_CALLBACK_URL
}

export function getPasswordRecoveryRedirectTo(): string {
  return Platform.OS === 'web' ? Linking.createURL('reset-password') : PASSWORD_RECOVERY_URL
}

export function isGoogleAuthCallbackUrl(url: string): boolean {
  return url.includes('auth/callback') || url.includes('callback')
}

export function isPasswordRecoveryUrl(url: string): boolean {
  return url.includes('reset-password')
}

export function extractAuthParams(url: string): URLSearchParams {
  const params = new URLSearchParams()

  const queryIndex = url.indexOf('?')
  const hashIndex = url.indexOf('#')

  if (queryIndex >= 0) {
    const queryEnd = hashIndex >= 0 && hashIndex > queryIndex ? hashIndex : undefined
    const query = url.slice(queryIndex + 1, queryEnd)
    new URLSearchParams(query).forEach((value, key) => params.set(key, value))
  }

  if (hashIndex >= 0) {
    const hash = url.slice(hashIndex + 1)
    new URLSearchParams(hash).forEach((value, key) => params.set(key, value))
  }

  return params
}
