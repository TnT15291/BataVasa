// Shared "vs previous period" percentage for report delta badges.
//
// Returns undefined (badge hidden) when a percentage would mislead rather than
// inform:
//  - the previous period had no data (prev === 0), or
//  - the previous base is too small for a relative % to be meaningful — a
//    1 → 11 jump reads as "+1000%" which is noise, not signal, or
//  - the magnitude is implausibly large (≥ 1000%), which only happens off a
//    near-zero base.
//
// Callers that compare an intrinsically small quantity (e.g. an average mood of
// ~2.5) must scale it up first (e.g. ×10) so MIN_BASE doesn't suppress it.
const MIN_BASE = 3

export function percentDelta(cur: number, prev: number): number | undefined {
  if (Math.abs(prev) < MIN_BASE) return undefined
  const pct = Math.round(((cur - prev) / Math.abs(prev)) * 100)
  if (Math.abs(pct) >= 1000) return undefined
  return pct
}
