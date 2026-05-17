import type { Locale } from 'date-fns'
import { vi, enUS, zhCN, ja, ko, fr } from 'date-fns/locale'

export const LANGUAGE_CURRENCY: Record<string, string> = {
  vi: 'VND',
  en: 'USD',
  zh: 'CNY',
  ja: 'JPY',
  ko: 'KRW',
  fr: 'EUR',
}

const SUPPORTED = ['vi', 'en', 'zh', 'ja', 'ko', 'fr']

export function getDeviceLanguage(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale
    const lang = locale.split('-')[0]
    return SUPPORTED.includes(lang!) ? lang! : 'en'
  } catch {
    return 'en'
  }
}

// BCP-47 locale tags for Intl.* APIs (NumberFormat, DateTimeFormat, Collator, …)
// Map our internal 2-letter language codes → full locale strings.
const INTL_LOCALES: Record<string, string> = {
  vi: 'vi-VN',
  en: 'en-US',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ko: 'ko-KR',
  fr: 'fr-FR',
}

export function getIntlLocale(language: string): string {
  return INTL_LOCALES[language] ?? 'en-US'
}

// date-fns Locale objects for `format()`, `formatDistance()`, etc.
const DATE_FNS_LOCALES: Record<string, Locale> = {
  vi,
  en: enUS,
  zh: zhCN,
  ja,
  ko,
  fr,
}

export function getDateFnsLocale(language: string): Locale {
  return DATE_FNS_LOCALES[language] ?? enUS
}
