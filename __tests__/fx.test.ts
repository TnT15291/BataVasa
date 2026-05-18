import { convertCents } from '../services/fx'

describe('convertCents', () => {
  const rates: Record<string, number> = {
    USD: 1,
    EUR: 0.92,
    VND: 24000,
    JPY: 150,
  }

  it('returns same amount when from === to', () => {
    expect(convertCents(10000, 'USD', 'USD', rates)).toBe(10000)
    expect(convertCents(500, 'VND', 'VND', rates)).toBe(500)
  })

  it('converts USD → EUR', () => {
    // 100 USD cents → ~92 EUR cents
    expect(convertCents(100, 'USD', 'EUR', rates)).toBe(92)
  })

  it('converts VND → USD', () => {
    // 24000 VND cents = 1 USD cent
    expect(convertCents(24000, 'VND', 'USD', rates)).toBe(1)
  })

  it('converts USD → VND', () => {
    // 1 USD cent → 24000 VND cents
    expect(convertCents(1, 'USD', 'VND', rates)).toBe(24000)
  })

  it('converts EUR → JPY', () => {
    // 0.92 EUR = 1 USD → 150 JPY
    // 92 EUR cents: /0.92 * 150 = 15000 JPY cents
    expect(convertCents(92, 'EUR', 'JPY', rates)).toBe(15000)
  })

  it('returns original when from currency missing from rates', () => {
    expect(convertCents(100, 'XXX', 'USD', rates)).toBe(100)
  })

  it('returns original when to currency missing from rates', () => {
    expect(convertCents(100, 'USD', 'XXX', rates)).toBe(100)
  })

  it('handles zero cents', () => {
    expect(convertCents(0, 'USD', 'EUR', rates)).toBe(0)
  })

  it('handles negative cents (expense)', () => {
    expect(convertCents(-100, 'USD', 'EUR', rates)).toBe(-92)
  })
})
