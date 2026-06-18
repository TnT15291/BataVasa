import { Platform } from 'react-native'
import { isExpoGo } from './expoGo'
import { logger } from './logger'

const MODULE = 'auth.google-native'

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID

export type NativeGoogleResult =
  | { ok: true; idToken: string }
  | { ok: false; cancelled: true }
  | { ok: false; error: string }

type GoogleModule = typeof import('@react-native-google-signin/google-signin')

declare const require: ((id: string) => GoogleModule) | undefined

let configured = false
let googleModule: GoogleModule | null | undefined

function getGoogleModule(): GoogleModule | null {
  if (isExpoGo()) return null
  if (googleModule !== undefined) return googleModule
  try {
    googleModule = typeof require === 'function'
      ? require('@react-native-google-signin/google-signin')
      : null
  } catch (e) {
    logger.warn(MODULE, 'native Google module unavailable', { error: String(e) })
    googleModule = null
  }
  return googleModule
}

export function isNativeGoogleAvailable(): boolean {
  return Boolean(WEB_CLIENT_ID) && getGoogleModule() !== null
}

export function configureGoogleSignin(): void {
  const mod = getGoogleModule()
  if (configured || !WEB_CLIENT_ID || !mod) return
  mod.GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
    offlineAccess: false,
  })
  configured = true
}

export async function nativeGoogleSignIn(): Promise<NativeGoogleResult> {
  const mod = getGoogleModule()
  if (!WEB_CLIENT_ID) return { ok: false, error: 'Google sign-in is not configured' }
  if (!mod) return { ok: false, error: 'Native Google sign-in is not available in Expo Go' }
  configureGoogleSignin()
  try {
    if (Platform.OS === 'android') {
      await mod.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
    }
    const response = await mod.GoogleSignin.signIn()
    if (mod.isSuccessResponse(response)) {
      const idToken = response.data.idToken
      if (!idToken) return { ok: false, error: 'No ID token returned from Google' }
      return { ok: true, idToken }
    }
    return { ok: false, cancelled: true }
  } catch (e) {
    if (mod.isErrorWithCode(e)) {
      if (e.code === mod.statusCodes.SIGN_IN_CANCELLED) return { ok: false, cancelled: true }
      if (e.code === mod.statusCodes.IN_PROGRESS) return { ok: false, error: 'Sign-in already in progress' }
      if (e.code === mod.statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return { ok: false, error: 'Google Play Services is not available or out of date' }
      }
    }
    logger.error(MODULE, 'nativeGoogleSignIn failed', { error: String(e) })
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function nativeGoogleSignOut(): Promise<void> {
  const mod = getGoogleModule()
  if (!WEB_CLIENT_ID || !mod) return
  try {
    await mod.GoogleSignin.signOut()
  } catch (e) {
    logger.warn(MODULE, 'nativeGoogleSignOut failed', { error: String(e) })
  }
}
