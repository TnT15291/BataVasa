import { vi as viLocale, enUS, zhCN, ja as jaLocale, ko as koLocale, fr as frLocale } from 'date-fns/locale'
import {
  getIntlLocale,
  getDateFnsLocale,
  getDeviceLanguage,
  LANGUAGE_CURRENCY,
} from '../services/locale'

describe('getIntlLocale', () => {
  it.each([
    ['vi', 'vi-VN'],
    ['en', 'en-US'],
    ['zh', 'zh-CN'],
    ['ja', 'ja-JP'],
    ['ko', 'ko-KR'],
    ['fr', 'fr-FR'],
  ])('maps %s → %s', (lang, expected) => {
    expect(getIntlLocale(lang)).toBe(expected)
  })

  it('falls back to en-US for unknown language', () => {
    expect(getIntlLocale('de')).toBe('en-US')
    expect(getIntlLocale('')).toBe('en-US')
  })
})

describe('getDateFnsLocale', () => {
  it.each([
    ['vi', viLocale],
    ['en', enUS],
    ['zh', zhCN],
    ['ja', jaLocale],
    ['ko', koLocale],
    ['fr', frLocale],
  ])('maps %s to its date-fns locale', (lang, expected) => {
    expect(getDateFnsLocale(lang)).toBe(expected)
  })

  it('falls back to enUS for unknown language', () => {
    expect(getDateFnsLocale('xx')).toBe(enUS)
  })
})

describe('LANGUAGE_CURRENCY', () => {
  it('maps each supported language to a default currency', () => {
    expect(LANGUAGE_CURRENCY).toEqual({
      vi: 'VND',
      en: 'USD',
      zh: 'CNY',
      ja: 'JPY',
      ko: 'KRW',
      fr: 'EUR',
    })
  })
})

describe('getDeviceLanguage', () => {
  it('returns a supported 2-letter language code or the en fallback', () => {
    const lang = getDeviceLanguage()
    expect(['vi', 'en', 'zh', 'ja', 'ko', 'fr']).toContain(lang)
  })

  it('falls back to en when Intl throws', () => {
    const spy = jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('no Intl')
    })
    expect(getDeviceLanguage()).toBe('en')
    spy.mockRestore()
  })

  it('falls back to en for an unsupported device locale', () => {
    const spy = jest.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ locale: 'de-DE' }),
    } as unknown as Intl.DateTimeFormat)
    expect(getDeviceLanguage()).toBe('en')
    spy.mockRestore()
  })

  it('returns the matched language for a supported device locale', () => {
    const spy = jest.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ locale: 'ja-JP' }),
    } as unknown as Intl.DateTimeFormat)
    expect(getDeviceLanguage()).toBe('ja')
    spy.mockRestore()
  })
})
