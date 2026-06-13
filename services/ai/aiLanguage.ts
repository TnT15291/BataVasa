import { useSettingsStore } from '@store/settingsStore'
import { getIntlLocale } from '@services/locale'

const LANGUAGE_NAMES: Record<string, string> = {
  vi: 'Vietnamese', en: 'English', zh: 'Chinese (Simplified)',
  ja: 'Japanese', ko: 'Korean', fr: 'French',
}

const SYMBOLS: Record<string, string> = {
  USD: '$', EUR: 'EUR ', GBP: 'GBP ', JPY: 'JPY ', CNY: 'CNY ', KRW: 'KRW ', THB: 'THB ', SGD: 'S$',
}

const NO_MINOR_UNIT = new Set(['VND', 'JPY', 'KRW'])

export function getAILanguage(): string {
  return LANGUAGE_NAMES[useSettingsStore.getState().language] ?? 'English'
}

export function getAICurrency(): string {
  return useSettingsStore.getState().currency
}

// Format amounts for AI prompt context (human-readable, currency-aware).
export function fmtAI(cents: number, currency: string): string {
  const abs = Math.abs(cents)
  if (currency === 'VND') {
    if (abs >= 1_000_000) return `${(abs / 1_000_000).toFixed(1)}M ₫`
    return `${Math.round(abs / 1_000)}k ₫`
  }

  const amount = NO_MINOR_UNIT.has(currency) ? abs : abs / 100
  const sym = SYMBOLS[currency] ?? ''
  const language = useSettingsStore.getState().language
  const locale = getIntlLocale(language)
  const formatted = amount % 1 === 0 ? amount.toLocaleString(locale) : amount.toFixed(2)
  return sym ? `${sym}${formatted}` : `${formatted} ${currency}`
}

// Currencies without minor units store raw whole units in amount_cents.
export function centsToDisplay(cents: number, currency: string): number {
  if (NO_MINOR_UNIT.has(currency)) return cents
  // Exact division — rounding here would silently drop cents when an existing
  // transaction is opened for editing (e.g. $12.50 becoming $13).
  return cents / 100
}

// Convert display number from input fields into storage amount.
export function displayToCents(display: number, currency: string): number {
  if (NO_MINOR_UNIT.has(currency)) return display
  return Math.round(display * 100)
}

// Tells the AI how to interpret amount_cents for the active currency.
export function getAmountRule(currency: string): string {
  if (currency === 'VND') {
    return 'amount_cents = raw VND (e.g. 50,000 VND -> 50000; "k"=x1,000; "trieu"/"M"=x1,000,000)'
  }
  if (['JPY', 'KRW'].includes(currency)) {
    return `amount_cents = raw ${currency} whole units (e.g. 500 ${currency} -> 500; "k"=x1,000)`
  }
  return `amount_cents = cents, i.e. ${currency} amount x100 (e.g. 5 ${currency} -> 500; 1k -> 100000)`
}
