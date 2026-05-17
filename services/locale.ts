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
    return SUPPORTED.includes(lang) ? lang : 'en'
  } catch {
    return 'en'
  }
}
