import * as LocalAuthentication from 'expo-local-authentication'
import { logger } from './logger'

const MODULE = 'biometric'

export type BiometricType = 'fingerprint' | 'face' | 'iris' | 'none'

export type BiometricSupport = {
  available: boolean
  type: BiometricType
}

export async function getBiometricSupport(): Promise<BiometricSupport> {
  try {
    const hardware = await LocalAuthentication.hasHardwareAsync()
    if (!hardware) return { available: false, type: 'none' }

    const enrolled = await LocalAuthentication.isEnrolledAsync()
    if (!enrolled) return { available: false, type: 'none' }

    const types = await LocalAuthentication.supportedAuthenticationTypesAsync()
    let type: BiometricType = 'fingerprint'
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      type = 'face'
    } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      type = 'iris'
    }
    return { available: true, type }
  } catch (e) {
    logger.warn(MODULE, 'getBiometricSupport failed', { error: String(e) })
    return { available: false, type: 'none' }
  }
}

export async function authenticate(promptMessage: string, cancelLabel: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: '',
      disableDeviceFallback: false,
      cancelLabel,
    })
    if (!result.success) {
      logger.info(MODULE, 'auth failed', { error: result.error })
    }
    return result.success
  } catch (e) {
    logger.warn(MODULE, 'authenticate threw', { error: String(e) })
    return false
  }
}
