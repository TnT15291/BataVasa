import { Platform } from 'react-native'
import * as Haptics from 'expo-haptics'
import { logger } from '@services/logger'

async function runHaptic(effect: () => Promise<void>) {
  if (Platform.OS === 'web') return

  try {
    await effect()
  } catch (e) {
    logger.warn('haptics', 'haptic feedback failed', { error: String(e) })
  }
}

export function hapticVoiceStart() {
  return runHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light))
}

export function hapticVoiceStop() {
  return runHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium))
}

export function hapticSaveSuccess() {
  return runHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success))
}
