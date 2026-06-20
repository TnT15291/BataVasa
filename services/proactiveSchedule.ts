// Pure scheduling helpers for the proactive weekly-review notification.
// Deliberately free of expo/DB imports so the logic stays unit-testable and the
// schedule math is shared by both the settings store and the notification
// service without dragging native modules into either.

// expo-notifications weekday convention: 1 = Sunday ... 7 = Saturday.
export const DEFAULT_WEEKLY_REVIEW_DAY = 1 // Sunday
export const DEFAULT_WEEKLY_REVIEW_HOUR = 9 // 09:00 local

export function clampWeekday(day: number): number {
  if (!Number.isFinite(day)) return DEFAULT_WEEKLY_REVIEW_DAY
  return Math.min(7, Math.max(1, Math.round(day)))
}

export function clampHour(hour: number): number {
  if (!Number.isFinite(hour)) return DEFAULT_WEEKLY_REVIEW_HOUR
  return Math.min(23, Math.max(0, Math.round(hour)))
}

export type WeeklyReviewSchedule = { weekday: number; hour: number; minute: number }

/** Normalize a stored day/hour into a valid weekly trigger (minute fixed at 0). */
export function buildWeeklyReviewTrigger(weekday: number, hour: number): WeeklyReviewSchedule {
  return { weekday: clampWeekday(weekday), hour: clampHour(hour), minute: 0 }
}

// A reference week (2024-01-07 is a Sunday) so callers can turn an expo weekday
// (1=Sun...7=Sat) into a real Date for locale-aware label formatting.
export function weekdayToDate(weekday: number): Date {
  const w = clampWeekday(weekday)
  return new Date(2024, 0, 6 + w) // 2024-01-07 = Sunday -> weekday 1
}
