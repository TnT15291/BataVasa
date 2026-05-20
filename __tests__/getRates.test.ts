import { getRates } from '../services/fx'

// Module-level cache persists across tests, so each test uses a distinct base
// currency to stay isolated (except the dedicated cache-hit test).
const okResponse = (rates: Record<string, number>) => ({
  ok: true,
  json: async () => ({ result: 'success', rates }),
})

describe('getRates', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('fetches rates and includes the base at rate 1', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(okResponse({ EUR: 0.92, VND: 24000 }) as any)
    const rates = await getRates('AAA')
    expect(rates).toEqual({ AAA: 1, EUR: 0.92, VND: 24000 })
  })

  it('serves a cached result without a second network call', async () => {
    const spy = jest.spyOn(global, 'fetch').mockResolvedValue(okResponse({ EUR: 0.9 }) as any)
    await getRates('CCC')
    await getRates('CCC')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('returns null on a non-ok HTTP response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, json: async () => ({}) } as any)
    expect(await getRates('BBB')).toBeNull()
  })

  it('returns null when the API result is not "success"', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'error', rates: {} }),
    } as any)
    expect(await getRates('DDD')).toBeNull()
  })

  it('returns null when fetch throws', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'))
    expect(await getRates('EEE')).toBeNull()
  })
})
