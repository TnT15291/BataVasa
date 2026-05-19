import { Platform } from 'react-native'

export function shouldWarnAboutWebSQLitePersistence() {
  if (Platform.OS !== 'web') return false

  const userAgent = globalThis.navigator?.userAgent ?? ''
  const isFirefox = /firefox|fxios/i.test(userAgent)
  const isChromium = /chrom(e|ium)|edg\//i.test(userAgent)

  return isFirefox && !isChromium
}
