/** In-memory FX rate cache with 1h TTL. Uses open.er-api.com (free, no key, ~160 currencies). */

type RateCache = { rates: Record<string, number>; expiry: number }
const CACHE = new Map<string, RateCache>()
const TTL_MS = 3_600_000 // 1h

export async function getRates(base: string): Promise<Record<string, number> | null> {
  const now = Date.now()
  const hit = CACHE.get(base)
  if (hit && now < hit.expiry) return hit.rates

  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`)
    if (!res.ok) return null
    const data = await res.json() as { result: string; rates: Record<string, number> }
    if (data.result !== 'success') return null
    const rates: Record<string, number> = { [base]: 1, ...data.rates }
    CACHE.set(base, { rates, expiry: now + TTL_MS })
    return rates
  } catch {
    return null
  }
}

/** Convert cents from one currency to another using rates fetched relative to `base`. */
export function convertCents(
  cents: number,
  from: string,
  to: string,
  rates: Record<string, number>
): number {
  if (from === to) return cents
  const fromRate = rates[from]
  const toRate = rates[to]
  if (!fromRate || !toRate) return cents
  return Math.round((cents / fromRate) * toRate)
}
