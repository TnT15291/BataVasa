import { Platform } from 'react-native'
import {
  GoogleSignin,
  statusCodes,
  isSuccessResponse,
  isErrorWithCode,
} from '@react-native-google-signin/google-signin'
import { logger } from './logger'

const MODULE = 'auth.google-native'

// Both client IDs come from Google Cloud Console → Credentials (see
// docs/auth-setup.md). The Web client ID is what `signInWithIdToken` validates
// against, so it is required on every platform; the iOS client ID is only needed
// for iOS builds. These are public OAuth client IDs (no secret), safe to bundle.
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID

export type NativeGoogleResult =
  | { ok: true; idToken: string }
  | { ok: false; cancelled: true }
  | { ok: false; error: string }

let configured = false

/**
 * True when the native flow is usable — i.e. a Web client ID is present. When
 * false the caller falls back to the OAuth web flow so a missing config never
 * blocks sign-in entirely.
 */
export function isNativeGoogleAvailable(): boolean {
  return Boolean(WEB_CLIENT_ID)
}

/** Idempotent — safe to call on every app start and before each sign-in. */
export function configureGoogleSignin(): void {
  if (configured || !WEB_CLIENT_ID) return
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
    // We only need an ID token for Supabase; no Google API access on the user's
    // behalf, so offline access / server auth code are unnecessary.
    offlineAccess: false,
  })
  configured = true
}

/**
 * Open the native Google account picker (Play Services sheet on Android,
 * the system dialog on iOS) and return the resulting ID token. No browser /
 * custom-tab redirect is involved.
 */
export async function nativeGoogleSignIn(): Promise<NativeGoogleResult> {
  if (!WEB_CLIENT_ID) return { ok: false, error: 'Google sign-in is not configured' }
  configureGoogleSignin()
  try {
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
    }
    const response = await GoogleSignin.signIn()
    if (isSuccessResponse(response)) {
      const idToken = response.data.idToken
      if (!idToken) return { ok: false, error: 'No ID token returned from Google' }
      return { ok: true, idToken }
    }
    // response.type === 'cancelled' — user dismissed the account picker.
    return { ok: false, cancelled: true }
  } catch (e) {
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED) return { ok: false, cancelled: true }
      if (e.code === statusCodes.IN_PROGRESS) return { ok: false, error: 'Sign-in already in progress' }
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return { ok: false, error: 'Google Play Services is not available or out of date' }
      }
    }
    logger.error(MODULE, 'nativeGoogleSignIn failed', { error: String(e) })
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Clear the cached native Google session so the next sign-in shows the account
 * picker instead of silently re-using the last account. Best-effort.
 */
export async function nativeGoogleSignOut(): Promise<void> {
  if (!WEB_CLIENT_ID) return
  try {
    await GoogleSignin.signOut()
  } catch (e) {
    logger.warn(MODULE, 'nativeGoogleSignOut failed', { error: String(e) })
  }
}
