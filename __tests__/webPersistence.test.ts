import { Platform } from 'react-native'
import { shouldWarnAboutWebSQLitePersistence } from '@services/webPersistence'

describe('web persistence warning', () => {
  const originalOS = Platform.OS
  const originalNavigator = globalThis.navigator

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS })
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
    })
  })

  function setRuntime(os: typeof Platform.OS, userAgent: string) {
    Object.defineProperty(Platform, 'OS', { value: os })
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent },
      configurable: true,
    })
  }

  it('warns for Firefox on web', () => {
    setRuntime('web', 'Mozilla/5.0 Firefox/126.0')

    expect(shouldWarnAboutWebSQLitePersistence()).toBe(true)
  })

  it('does not warn for Chrome on web', () => {
    setRuntime('web', 'Mozilla/5.0 Chrome/126.0 Safari/537.36')

    expect(shouldWarnAboutWebSQLitePersistence()).toBe(false)
  })

  it('does not warn on native platforms', () => {
    setRuntime('ios', 'Mozilla/5.0 FxiOS/126.0')

    expect(shouldWarnAboutWebSQLitePersistence()).toBe(false)
  })
})
