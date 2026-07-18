import { dateOnlyFromAI, localDateString, toLocalISOString } from '../services/localTime'

describe('local time helpers', () => {
  it('preserves the written date from AI date-only datetime strings with timezone offsets', () => {
    expect(dateOnlyFromAI('2026-07-05T00:00:00+07:00')).toBe('2026-07-05')
    expect(dateOnlyFromAI('2026-07-05')).toBe('2026-07-05')
  })

  it('formats local date without converting through UTC first', () => {
    expect(localDateString(new Date(2026, 6, 5, 0, 30, 0))).toBe('2026-07-05')
  })

  it('includes a timezone offset in local ISO prompt timestamps', () => {
    expect(toLocalISOString(new Date(2026, 6, 5, 14, 13, 25))).toMatch(
      /^2026-07-05T14:13:25[+-]\d{2}:\d{2}$/
    )
  })
})
