import { ok, err, appErr, unwrap } from '../services/result'

describe('ok', () => {
  it('returns ok result with value', () => {
    const r = ok(42)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBe(42)
  })

  it('works with objects', () => {
    const r = ok({ id: '1', name: 'test' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.name).toBe('test')
  })

  it('works with null', () => {
    const r = ok(null)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBeNull()
  })
})

describe('err', () => {
  it('returns err result with error', () => {
    const r = err({ code: 'NOT_FOUND' as const, message: 'missing' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('NOT_FOUND')
  })
})

describe('appErr', () => {
  it('creates a typed AppError result', () => {
    const r = appErr('DB_ERROR', 'disk full')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.code).toBe('DB_ERROR')
      expect(r.error.message).toBe('disk full')
    }
  })

  it('preserves cause', () => {
    const cause = new Error('original')
    const r = appErr('INTERNAL', 'wrapped', cause)
    if (!r.ok) expect(r.error.cause).toBe(cause)
  })
})

describe('unwrap', () => {
  it('returns value for ok result', () => {
    expect(unwrap(ok('hello'))).toBe('hello')
  })

  it('throws for err result', () => {
    expect(() => unwrap(appErr('NOT_FOUND', 'gone'))).toThrow('[NOT_FOUND] gone')
  })
})
