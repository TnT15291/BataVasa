import {
  clampWeekday,
  clampHour,
  buildWeeklyReviewTrigger,
  weekdayToDate,
  DEFAULT_WEEKLY_REVIEW_DAY,
  DEFAULT_WEEKLY_REVIEW_HOUR,
} from '../services/proactiveSchedule'

describe('proactive weekly-review schedule helpers', () => {
  it('clamps the weekday into the expo 1-7 range', () => {
    expect(clampWeekday(1)).toBe(1)
    expect(clampWeekday(7)).toBe(7)
    expect(clampWeekday(0)).toBe(1)
    expect(clampWeekday(8)).toBe(7)
    expect(clampWeekday(3.4)).toBe(3)
    expect(clampWeekday(NaN)).toBe(DEFAULT_WEEKLY_REVIEW_DAY)
  })

  it('clamps the hour into 0-23', () => {
    expect(clampHour(0)).toBe(0)
    expect(clampHour(23)).toBe(23)
    expect(clampHour(-1)).toBe(0)
    expect(clampHour(24)).toBe(23)
    expect(clampHour(9.6)).toBe(10)
    expect(clampHour(NaN)).toBe(DEFAULT_WEEKLY_REVIEW_HOUR)
  })

  it('builds a normalized weekly trigger with minute fixed at 0', () => {
    expect(buildWeeklyReviewTrigger(3, 8)).toEqual({ weekday: 3, hour: 8, minute: 0 })
    expect(buildWeeklyReviewTrigger(99, 99)).toEqual({ weekday: 7, hour: 23, minute: 0 })
  })

  it('maps expo weekday numbers to the matching calendar weekday', () => {
    // JS getDay(): 0=Sun … 6=Sat. expo weekday: 1=Sun … 7=Sat.
    expect(weekdayToDate(1).getDay()).toBe(0) // Sunday
    expect(weekdayToDate(2).getDay()).toBe(1) // Monday
    expect(weekdayToDate(7).getDay()).toBe(6) // Saturday
  })
})
