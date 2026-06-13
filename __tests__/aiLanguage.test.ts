const fakeState = { language: 'en', currency: 'USD' }

jest.mock('@store/settingsStore', () => ({
  useSettingsStore: { getState: () => fakeState },
}))

import {
  fmtAI,
  centsToDisplay,
  displayToCents,
  getAmountRule,
  getAILanguage,
  getAICurrency,
} from '../services/ai/aiLanguage'

beforeEach(() => {
  fakeState.language = 'en'
  fakeState.currency = 'USD'
})

describe('fmtAI', () => {
  it('formats VND millions as M with dong symbol', () => {
    expect(fmtAI(2_500_000, 'VND')).toBe('2.5M ₫')
  })

  it('formats VND thousands as k with dong symbol', () => {
    expect(fmtAI(50_000, 'VND')).toBe('50k ₫')
  })

  it('formats whole USD with $ symbol and no decimals', () => {
    expect(fmtAI(5000, 'USD')).toBe('$50')
  })

  it('formats fractional USD with two decimals', () => {
    expect(fmtAI(12345, 'USD')).toBe('$123.45')
  })

  it('formats zero-decimal currencies as whole units', () => {
    expect(fmtAI(500, 'JPY')).toBe('JPY 500')
    expect(fmtAI(500, 'KRW')).toBe('KRW 500')
  })

  it('uses absolute value for negative expense amounts', () => {
    expect(fmtAI(-5000, 'USD')).toBe('$50')
  })

  it('falls back to "<amount> <code>" for a currency without a symbol', () => {
    expect(fmtAI(10000, 'AUD')).toBe('100 AUD')
  })
})

describe('centsToDisplay', () => {
  it('keeps raw value for no-minor-unit currencies', () => {
    expect(centsToDisplay(50_000, 'VND')).toBe(50_000)
    expect(centsToDisplay(50_000, 'JPY')).toBe(50_000)
    expect(centsToDisplay(50_000, 'KRW')).toBe(50_000)
  })

  it('divides by 100 for minor-unit currencies', () => {
    expect(centsToDisplay(5000, 'USD')).toBe(50)
    // Exact — editing a transaction must not round away the cents.
    expect(centsToDisplay(12345, 'EUR')).toBe(123.45)
  })
})

describe('displayToCents', () => {
  it('keeps raw value for no-minor-unit currencies', () => {
    expect(displayToCents(50_000, 'VND')).toBe(50_000)
    expect(displayToCents(500, 'JPY')).toBe(500)
  })

  it('multiplies by 100 for minor-unit currencies', () => {
    expect(displayToCents(50, 'USD')).toBe(5000)
  })

  it('round-trips with centsToDisplay for whole minor-unit amounts', () => {
    expect(displayToCents(centsToDisplay(5000, 'USD'), 'USD')).toBe(5000)
  })
})

describe('getAmountRule', () => {
  it('describes raw VND for VND', () => {
    expect(getAmountRule('VND')).toContain('raw VND')
  })

  it('describes whole units for JPY and KRW', () => {
    expect(getAmountRule('JPY')).toContain('whole units')
    expect(getAmountRule('KRW')).toContain('whole units')
  })

  it('describes cents for other currencies', () => {
    expect(getAmountRule('USD')).toContain('cents')
  })
})

describe('getAILanguage / getAICurrency', () => {
  it('maps the stored language code to an English language name', () => {
    fakeState.language = 'ja'
    expect(getAILanguage()).toBe('Japanese')
    fakeState.language = 'vi'
    expect(getAILanguage()).toBe('Vietnamese')
  })

  it('falls back to English for an unknown language code', () => {
    fakeState.language = 'de'
    expect(getAILanguage()).toBe('English')
  })

  it('returns the stored currency code', () => {
    fakeState.currency = 'VND'
    expect(getAICurrency()).toBe('VND')
  })
})
