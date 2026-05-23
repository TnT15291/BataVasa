/** In-memory FX rate cache with 1h TTL. Uses open.er-api.com (free, no key, ~160 currencies). */

type RateCache = { rates: Record<string, number>; expiry: number }
const CACHE = new Map<string, RateCache>()
const TTL_MS = 3_600_000 // 1h
const ZERO_DECIMAL_CURRENCIES = new Set(['VND', 'JPY', 'KRW'])

type MoneyLike = {
  amount_cents: number
  currency: string
}

function code(currency: string): string {
  return currency.toUpperCase()
}

export function minorUnit(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(code(currency)) ? 1 : 100
}

export function toMajorAmount(amount: number, currency: string): number {
  return amount / minorUnit(currency)
}

export function fromMajorAmount(amount: number, currency: string): number {
  return Math.round(amount * minorUnit(currency))
}

export async function getRates(base: string): Promise<Record<string, number> | null> {
  const now = Date.now()
  const normalizedBase = code(base)
  const hit = CACHE.get(normalizedBase)
  if (hit && now < hit.expiry) return hit.rates

  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${normalizedBase}`)
    if (!res.ok) return null
    const data = await res.json() as { result: string; rates: Record<string, number> }
    if (data.result !== 'success') return null
    const rates: Record<string, number> = { [normalizedBase]: 1, ...data.rates }
    CACHE.set(normalizedBase, { rates, expiry: now + TTL_MS })
    return rates
  } catch {
    return null
  }
}

export function convertMinorAmount(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>
): number | null {
  const fromCurrency = code(from)
  const toCurrency = code(to)
  if (fromCurrency === toCurrency) return amount

  const fromRate = rates[fromCurrency]
  const toRate = rates[toCurrency]
  if (!fromRate || !toRate) return null

  const fromMajor = toMajorAmount(amount, fromCurrency)
  const baseMajor = fromMajor / fromRate
  const toMajor = baseMajor * toRate
  return fromMajorAmount(toMajor, toCurrency)
}

export function signedAmountInCurrency(
  tx: MoneyLike,
  targetCurrency: string,
  rates: Record<string, number> | null,
  fallbackCurrency?: string
): number | null {
  if (code(tx.currency) === code(targetCurrency)) return tx.amount_cents
  if (rates) return convertMinorAmount(tx.amount_cents, tx.currency, targetCurrency, rates)
  if (fallbackCurrency && code(tx.currency) === code(fallbackCurrency)) return tx.amount_cents
  return null
}

export function summarizeInCurrency(
  txs: MoneyLike[],
  targetCurrency: string,
  rates: Record<string, number> | null,
  fallbackCurrency?: string
) {
  return txs.reduce(
    (acc, tx) => {
      const amount = signedAmountInCurrency(tx, targetCurrency, rates, fallbackCurrency)
      if (amount === null) {
        acc.skipped += 1
        return acc
      }
      if (amount > 0) acc.income += amount
      else acc.expense += Math.abs(amount)
      return acc
    },
    { income: 0, expense: 0, skipped: 0 }
  )
}

/** Backward-compatible wrapper for older call sites. Prefer convertMinorAmount for null-aware conversion. */
export function convertCents(
  cents: number,
  from: string,
  to: string,
  rates: Record<string, number>
): number {
  return convertMinorAmount(cents, from, to, rates) ?? cents
}
