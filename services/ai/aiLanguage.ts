import { useSettingsStore } from '@store/settingsStore'

const LANGUAGE_NAMES: Record<string, string> = {
  vi: 'Vietnamese', en: 'English', zh: 'Chinese (Simplified)',
  ja: 'Japanese', ko: 'Korean', fr: 'French',
}

export function getAILanguage(): string {
  return LANGUAGE_NAMES[useSettingsStore.getState().language] ?? 'English'
}

export function getAICurrency(): string {
  return useSettingsStore.getState().currency
}

// Format amounts for AI prompt context (human-readable, currency-aware)
export function fmtAI(cents: number, currency: string): string {
  const abs = Math.abs(cents)
  if (currency === 'VND') {
    if (abs >= 1_000_000) return `${(abs / 1_000_000).toFixed(1)}M ₫`
    return `${Math.round(abs / 1_000)}k ₫`
  }
  const amount = abs / 100
  const SYM: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', KRW: '₩', THB: '฿', SGD: 'S$',
  }
  const sym = SYM[currency] ?? ''
  const formatted = amount % 1 === 0 ? amount.toLocaleString('en') : amount.toFixed(2)
  return sym ? `${sym}${formatted}` : `${formatted} ${currency}`
}

// Currencies without minor units — amount_cents stores raw whole units.
const NO_MINOR_UNIT = new Set(['VND', 'JPY', 'KRW'])

// Convert stored amount_cents → display number for input fields.
// e.g. VND 50000 → 50000 ; USD 5000 (cents) → 50
export function centsToDisplay(cents: number, currency: string): number {
  if (NO_MINOR_UNIT.has(currency)) return cents
  return Math.round(cents / 100)
}

// Convert display number (from input field) → amount_cents for storage.
// e.g. VND 50000 → 50000 ; USD 50 → 5000 (cents)
export function displayToCents(display: number, currency: string): number {
  if (NO_MINOR_UNIT.has(currency)) return display
  return Math.round(display * 100)
}

// Tells the AI how to interpret amount_cents for the active currency
export function getAmountRule(currency: string): string {
  if (currency === 'VND') {
    return 'amount_cents = raw VND (e.g. 50,000₫ → 50000; "k"=×1000, "triệu"/"M"=×1,000,000)'
  }
  if (['JPY', 'KRW'].includes(currency)) {
    return `amount_cents = ${currency} amount × 100 (e.g. ¥500 → 50000; "k"=×100,000 in cents)`
  }
  return `amount_cents = cents, i.e. ${currency} amount × 100 (e.g. $5 → 500; $1k → 100000)`
}
