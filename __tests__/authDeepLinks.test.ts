jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}))

jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `exp://127.0.0.1:8081/--/${path}`),
}))

import { Platform } from 'react-native'
import {
  extractAuthParams,
  getGoogleAuthRedirectTo,
  getPasswordRecoveryRedirectTo,
  GOOGLE_AUTH_CALLBACK_URL,
  PASSWORD_RECOVERY_URL,
  isGoogleAuthCallbackUrl,
  isPasswordRecoveryUrl,
} from '../services/authDeepLinks'

describe('authDeepLinks', () => {
  it('uses fixed custom-scheme redirects on native platforms', () => {
    ;(Platform as any).OS = 'ios'

    expect(getGoogleAuthRedirectTo()).toBe(GOOGLE_AUTH_CALLBACK_URL)
    expect(getPasswordRecoveryRedirectTo()).toBe(PASSWORD_RECOVERY_URL)
  })

  it('uses Expo linking URLs on web', () => {
    ;(Platform as any).OS = 'web'

    expect(getGoogleAuthRedirectTo()).toBe('exp://127.0.0.1:8081/--/auth/callback')
    expect(getPasswordRecoveryRedirectTo()).toBe('exp://127.0.0.1:8081/--/reset-password')
  })

  it('extracts auth params from query and hash fragments', () => {
    expect(extractAuthParams('batavasa://auth/callback?code=abc').get('code')).toBe('abc')
    expect(extractAuthParams('batavasa://reset-password#access_token=a&refresh_token=r').get('refresh_token')).toBe('r')

    const merged = extractAuthParams('batavasa://auth/callback?code=abc#access_token=a')
    expect(merged.get('code')).toBe('abc')
    expect(merged.get('access_token')).toBe('a')
  })

  it('recognizes app auth URLs', () => {
    expect(isGoogleAuthCallbackUrl('batavasa://auth/callback?code=abc')).toBe(true)
    expect(isPasswordRecoveryUrl('batavasa://reset-password?code=abc')).toBe(true)
    expect(isPasswordRecoveryUrl('batavasa://auth/callback?code=abc')).toBe(false)
  })
})
