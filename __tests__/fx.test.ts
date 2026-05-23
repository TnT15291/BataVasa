import {
  convertCents,
  convertMinorAmount,
  fromMajorAmount,
  minorUnit,
  signedAmountInCurrency,
  summarizeInCurrency,
  toMajorAmount,
} from '../services/fx'

const rates: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  VND: 24000,
  JPY: 150,
}

describe('convertCents', () => {
  it('returns same amount when from === to', () => {
    expect(convertCents(10000, 'USD', 'USD', rates)).toBe(10000)
    expect(convertCents(500, 'VND', 'VND', rates)).toBe(500)
  })

  it('converts USD to EUR', () => {
    expect(convertCents(100, 'USD', 'EUR', rates)).toBe(92)
  })

  it('converts VND whole units to USD cents', () => {
    expect(convertCents(24000, 'VND', 'USD', rates)).toBe(100)
  })

  it('converts USD cents to VND whole units', () => {
    expect(convertCents(1, 'USD', 'VND', rates)).toBe(240)
  })

  it('converts EUR cents to JPY whole units', () => {
    expect(convertCents(92, 'EUR', 'JPY', rates)).toBe(150)
  })

  it('returns original when from currency missing from rates', () => {
    expect(convertCents(100, 'XXX', 'USD', rates)).toBe(100)
  })

  it('returns original when to currency missing from rates', () => {
    expect(convertCents(100, 'USD', 'XXX', rates)).toBe(100)
  })

  it('handles zero and negative amounts', () => {
    expect(convertCents(0, 'USD', 'EUR', rates)).toBe(0)
    expect(convertCents(-100, 'USD', 'EUR', rates)).toBe(-92)
  })
})

describe('minor-unit helpers', () => {
  it('uses whole units for zero-decimal currencies', () => {
    expect(minorUnit('vnd')).toBe(1)
    expect(minorUnit('JPY')).toBe(1)
    expect(minorUnit('KRW')).toBe(1)
  })

  it('uses 100 minor units for regular currencies', () => {
    expect(minorUnit('USD')).toBe(100)
    expect(minorUnit('EUR')).toBe(100)
  })

  it('converts stored amount to major amount', () => {
    expect(toMajorAmount(12345, 'USD')).toBe(123.45)
    expect(toMajorAmount(12345, 'VND')).toBe(12345)
  })

  it('converts major amount to stored amount', () => {
    expect(fromMajorAmount(123.45, 'USD')).toBe(12345)
    expect(fromMajorAmount(12345, 'VND')).toBe(12345)
  })
})

describe('convertMinorAmount', () => {
  it('returns null when a rate is missing', () => {
    expect(convertMinorAmount(100, 'XXX', 'USD', rates)).toBeNull()
    expect(convertMinorAmount(100, 'USD', 'XXX', rates)).toBeNull()
  })

  it('normalizes lowercase currency codes', () => {
    expect(convertMinorAmount(100, 'usd', 'eur', rates)).toBe(92)
  })
})

describe('signedAmountInCurrency / summarizeInCurrency', () => {
  const txs = [
    { amount_cents: 100, currency: 'USD' },
    { amount_cents: -24000, currency: 'VND' },
    { amount_cents: -92, currency: 'EUR' },
    { amount_cents: -500, currency: 'XXX' },
  ]

  it('converts signed amounts when rates are available', () => {
    expect(signedAmountInCurrency(txs[1], 'USD', rates)).toBe(-100)
  })

  it('uses fallback currency when rates are unavailable', () => {
    expect(signedAmountInCurrency(txs[0], 'USD', null, 'USD')).toBe(100)
    expect(signedAmountInCurrency(txs[1], 'USD', null, 'USD')).toBeNull()
    expect(signedAmountInCurrency(txs[0], 'EUR', null)).toBeNull()
  })

  it('summarizes income, expense, and skipped rows', () => {
    expect(summarizeInCurrency(txs, 'USD', rates)).toEqual({
      income: 100,
      expense: 200,
      skipped: 1,
    })
  })
})
