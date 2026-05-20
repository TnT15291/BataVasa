import { uuid } from '../services/uuid'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('uuid', () => {
  it('returns an RFC-4122 v4 formatted string', () => {
    expect(uuid()).toMatch(UUID_V4)
  })

  it('sets the version nibble to 4 and variant to 8-b', () => {
    for (let i = 0; i < 50; i++) {
      const id = uuid()
      expect(id[14]).toBe('4')
      expect('89ab').toContain(id[19])
    }
  })

  it('generates unique values across many calls', () => {
    const set = new Set(Array.from({ length: 1000 }, () => uuid()))
    expect(set.size).toBe(1000)
  })
})
