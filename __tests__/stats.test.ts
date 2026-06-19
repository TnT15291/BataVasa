import { percentDelta } from '../services/stats'

describe('percentDelta', () => {
  it('hides the badge when the previous period had no data', () => {
    expect(percentDelta(11, 0)).toBeUndefined()
  })

  it('hides the badge when the previous base is too small to be meaningful', () => {
    // 1 → 11 would read as "+1000%" — noise, not signal.
    expect(percentDelta(11, 1)).toBeUndefined()
    expect(percentDelta(5, 2)).toBeUndefined()
  })

  it('hides implausibly large magnitudes (near-zero base)', () => {
    // prev = 3 (the min base) but a 3 → 100 jump is still noise.
    expect(percentDelta(100, 3)).toBeUndefined()
  })

  it('returns a rounded relative percentage for meaningful bases', () => {
    expect(percentDelta(11, 10)).toBe(10)
    expect(percentDelta(50, 100)).toBe(-50)
    expect(percentDelta(1_200_000, 1_000_000)).toBe(20)
  })

  it('treats no change as 0 (badge component hides 0 itself)', () => {
    expect(percentDelta(10, 10)).toBe(0)
  })
})
