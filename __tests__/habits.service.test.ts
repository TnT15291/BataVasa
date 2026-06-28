jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }))
jest.mock('../services/analytics', () => ({ track: jest.fn() }))
jest.mock('../services/i18n', () => ({
  getTranslations: () => ({ habit_notification_body: 'Time for your habit!' }),
}))
jest.mock('../database/sync/queue', () => ({ enqueue: jest.fn() }))

jest.mock('../database/habits/queries', () => ({
  insertHabit: jest.fn(),
  updateHabit: jest.fn(),
  getHabit: jest.fn(),
  softDeleteHabit: jest.fn(),
  listHabits: jest.fn(),
  wipeHabits: jest.fn(),
  exportHabitsData: jest.fn(),
  insertHabitLog: jest.fn(),
  softDeleteHabitLog: jest.fn(),
  countLogsInRange: jest.fn(),
  getLatestLogInRange: jest.fn(),
  listLogRowsInRange: jest.fn(),
  listLogsSince: jest.fn(),
}))

jest.mock('../database/core/db', () => ({
  nowIso: () => '2026-01-01T00:00:00.000Z',
  getDB: jest.fn(),
}))

jest.mock('../services/uuid', () => ({ uuid: () => 'f47ac10b-58cc-4372-a567-0e02b2c3d479' }))
jest.mock('../services/identity', () => ({ getCurrentUserId: () => null }))
jest.mock('../services/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))
jest.mock('../services/notifications', () => ({
  scheduleHabitNotifications: jest.fn(),
  cancelHabitNotifications: jest.fn(),
}))

import * as q from '../database/habits/queries'
import {
  createHabit,
  updateHabit,
  deleteHabit,
  loadHabits,
  wipeAllHabits,
  exportAllHabits,
  logHabit,
  skipHabit,
  unlogHabit,
  getHabitStreak,
  getTodayLogCount,
  getCurrentPeriodLogCount,
  getHabitPeriodRange,
  getLocalDateString,
  localDayBoundsIso,
  bucketLogsByLocalDate,
  isHabitDueOnDate,
  wasHabitMissedYesterday,
  buildImplementationIntention,
  computeHabitStats,
  loadHabitsWithStats,
} from '../features/habits/services'
import type { Habit } from '../features/habits/types'

const mockQ = q as jest.Mocked<typeof q>

const baseHabit: Habit = {
  id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  user_id: null,
  name: 'Morning run',
  icon: '🏃',
  color: '#22C55E',
  cadence: 'daily',
  target_per_period: 1,
  schedule_days: null,
  notification_times: null,
  identity: null,
  location_lat: null,
  location_lng: null,
  location_label: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  synced_at: null,
}

beforeEach(() => jest.resetAllMocks())

describe('createHabit', () => {
  it('creates a habit and returns it', async () => {
    mockQ.insertHabit.mockResolvedValue(undefined as any)
    const result = await createHabit({
      name: 'Morning run',
      icon: '🏃',
      color: '#22C55E',
      cadence: 'daily',
      target_per_period: 1,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.name).toBe('Morning run')
      expect(result.value.cadence).toBe('daily')
    }
  })

  it('returns VALIDATION_FAILED for empty name', async () => {
    const result = await createHabit({ name: '', icon: '✅', color: '#000', cadence: 'daily', target_per_period: 1 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_FAILED')
  })

  it('stores the identity field (Atomic Habits)', async () => {
    mockQ.insertHabit.mockResolvedValue(undefined as any)
    const result = await createHabit({ name: 'Run', icon: '🏃', color: '#22C55E', cadence: 'daily', target_per_period: 1, identity: 'a runner' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.identity).toBe('a runner')
  })

  it('returns VALIDATION_FAILED for invalid cadence', async () => {
    const result = await createHabit({
      name: 'Test',
      icon: '✅',
      color: '#000',
      cadence: 'hourly' as any,
      target_per_period: 1,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_FAILED')
  })

  it('returns DB_ERROR when insert throws', async () => {
    mockQ.insertHabit.mockRejectedValue(new Error('db error'))
    const result = await createHabit({ name: 'Run', icon: '🏃', color: '#22C55E', cadence: 'daily', target_per_period: 1 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DB_ERROR')
  })
})

describe('deleteHabit', () => {
  it('soft-deletes existing habit', async () => {
    mockQ.getHabit.mockResolvedValue(baseHabit)
    mockQ.softDeleteHabit.mockResolvedValue(undefined as any)
    const result = await deleteHabit('f47ac10b-58cc-4372-a567-0e02b2c3d479')
    expect(result.ok).toBe(true)
    expect(mockQ.softDeleteHabit).toHaveBeenCalledWith('f47ac10b-58cc-4372-a567-0e02b2c3d479', expect.any(String))
  })

  it('returns NOT_FOUND for nonexistent habit', async () => {
    mockQ.getHabit.mockResolvedValue(null)
    const result = await deleteHabit('nope')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
  })
})

describe('loadHabits', () => {
  it('returns list of habits', async () => {
    mockQ.listHabits.mockResolvedValue([baseHabit])
    const result = await loadHabits()
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toHaveLength(1)
  })
})

describe('wipeAllHabits', () => {
  it('returns deleted count', async () => {
    mockQ.listHabits.mockResolvedValue([])
    mockQ.wipeHabits.mockResolvedValue(3)
    const result = await wipeAllHabits()
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.deleted).toBe(3)
  })
})

describe('logHabit', () => {
  it('creates a log entry', async () => {
    mockQ.insertHabitLog.mockResolvedValue(undefined as any)
    const result = await logHabit({ habit_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', occurred_at: '2026-01-01T08:00:00.000Z' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.habit_id).toBe('f47ac10b-58cc-4372-a567-0e02b2c3d479')
    }
  })

  it('returns VALIDATION_FAILED for missing habit_id', async () => {
    const result = await logHabit({ habit_id: '', occurred_at: '2026-01-01T08:00:00.000Z' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_FAILED')
  })
})

describe('updateHabit', () => {
  it('updates fields and returns fresh habit', async () => {
    mockQ.getHabit.mockResolvedValue(baseHabit)
    mockQ.updateHabit.mockResolvedValue(undefined as any)
    mockQ.getHabit.mockResolvedValueOnce(baseHabit).mockResolvedValueOnce({ ...baseHabit, name: 'Evening run' })
    const result = await updateHabit({ id: baseHabit.id, name: 'Evening run' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.name).toBe('Evening run')
  })

  it('returns VALIDATION_FAILED for empty id', async () => {
    const result = await updateHabit({ id: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_FAILED')
  })

  it('updates the identity field', async () => {
    mockQ.getHabit.mockResolvedValueOnce(baseHabit).mockResolvedValueOnce({ ...baseHabit, identity: 'a reader' })
    mockQ.updateHabit.mockResolvedValue(undefined as any)
    const result = await updateHabit({ id: baseHabit.id, identity: 'a reader' })
    expect(result.ok).toBe(true)
    expect(mockQ.updateHabit).toHaveBeenCalledWith(baseHabit.id, expect.objectContaining({ identity: 'a reader' }))
  })

  it('returns NOT_FOUND when habit missing', async () => {
    mockQ.getHabit.mockResolvedValue(null)
    const result = await updateHabit({ id: baseHabit.id, name: 'X' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
  })

  it('reschedules notifications when notification_times updated', async () => {
    const { cancelHabitNotifications, scheduleHabitNotifications } = require('../services/notifications')
    mockQ.getHabit.mockResolvedValue(baseHabit).mockResolvedValueOnce(baseHabit).mockResolvedValueOnce(baseHabit)
    mockQ.updateHabit.mockResolvedValue(undefined as any)
    await updateHabit({ id: baseHabit.id, notification_times: '["08:00"]' })
    expect(cancelHabitNotifications).toHaveBeenCalledWith(baseHabit.id)
    expect(scheduleHabitNotifications).toHaveBeenCalled()
  })

  it('reschedules notifications when name updated and habit had times', async () => {
    const { cancelHabitNotifications } = require('../services/notifications')
    const habitWithTimes = { ...baseHabit, notification_times: '["07:00"]' }
    mockQ.getHabit.mockResolvedValueOnce(habitWithTimes).mockResolvedValueOnce(habitWithTimes)
    mockQ.updateHabit.mockResolvedValue(undefined as any)
    await updateHabit({ id: baseHabit.id, name: 'New name' })
    expect(cancelHabitNotifications).toHaveBeenCalledWith(baseHabit.id)
  })

  it('clears schedule_days when cadence is not custom', async () => {
    mockQ.getHabit.mockResolvedValue({ ...baseHabit, cadence: 'custom', schedule_days: '1,2,3' })
    mockQ.updateHabit.mockResolvedValue(undefined as any)
    mockQ.getHabit.mockResolvedValueOnce({ ...baseHabit, cadence: 'custom', schedule_days: '1,2,3' })
      .mockResolvedValueOnce({ ...baseHabit, cadence: 'daily', schedule_days: null })
    await updateHabit({ id: baseHabit.id, cadence: 'daily' })
    expect(mockQ.updateHabit).toHaveBeenCalledWith(baseHabit.id, expect.objectContaining({ schedule_days: null }))
  })

  it('returns DB_ERROR when update throws', async () => {
    mockQ.getHabit.mockResolvedValue(baseHabit)
    mockQ.updateHabit.mockRejectedValue(new Error('disk full'))
    const result = await updateHabit({ id: baseHabit.id, name: 'X' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DB_ERROR')
  })

  it('returns INTERNAL when fresh habit vanishes after update', async () => {
    mockQ.getHabit.mockResolvedValueOnce(baseHabit).mockResolvedValueOnce(null)
    mockQ.updateHabit.mockResolvedValue(undefined as any)
    const result = await updateHabit({ id: baseHabit.id, name: 'Ghost' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INTERNAL')
  })
})

describe('exportAllHabits', () => {
  it('returns JSON string with exported_at', async () => {
    mockQ.exportHabitsData.mockResolvedValue({ habits: [baseHabit], logs: [] })
    const result = await exportAllHabits()
    expect(result.ok).toBe(true)
    if (result.ok) {
      const parsed = JSON.parse(result.value)
      expect(parsed.exported_at).toBeDefined()
      expect(parsed.habits).toHaveLength(1)
    }
  })

  it('returns DB_ERROR when export throws', async () => {
    mockQ.exportHabitsData.mockRejectedValue(new Error('fail'))
    const result = await exportAllHabits()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DB_ERROR')
  })
})

describe('skipHabit', () => {
  it('creates a skip log when none exists', async () => {
    mockQ.getLatestLogInRange.mockResolvedValue(null)
    mockQ.insertHabitLog.mockResolvedValue(undefined as any)
    const result = await skipHabit(baseHabit.id, '2026-01-05')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.skipped).toBe(1)
      expect(result.value.note).toBe('Skipped')
    }
  })

  it('returns existing log if already skipped today', async () => {
    const existingLog = {
      id: 'log-1', habit_id: baseHabit.id, user_id: null,
      occurred_at: '2026-01-05T12:00:00.000Z', note: 'Skipped', skipped: 1,
      created_at: '2026-01-05T00:00:00.000Z', updated_at: '2026-01-05T00:00:00.000Z',
      deleted_at: null, synced_at: null,
    }
    mockQ.getLatestLogInRange.mockResolvedValue(existingLog)
    const result = await skipHabit(baseHabit.id, '2026-01-05')
    expect(result.ok).toBe(true)
    expect(mockQ.insertHabitLog).not.toHaveBeenCalled()
  })

  it('returns DB_ERROR when insert throws', async () => {
    mockQ.getLatestLogInRange.mockResolvedValue(null)
    mockQ.insertHabitLog.mockRejectedValue(new Error('disk full'))
    const result = await skipHabit(baseHabit.id, '2026-01-05')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DB_ERROR')
  })
})

describe('unlogHabit', () => {
  const log = {
    id: 'log-1', habit_id: baseHabit.id, user_id: null,
    occurred_at: '2026-01-05T08:00:00.000Z', note: null, skipped: 0,
    created_at: '2026-01-05T00:00:00.000Z', updated_at: '2026-01-05T00:00:00.000Z',
    deleted_at: null, synced_at: null,
  }

  it('soft-deletes log found by date string', async () => {
    mockQ.getLatestLogInRange.mockResolvedValue(log)
    mockQ.softDeleteHabitLog.mockResolvedValue(undefined as any)
    const result = await unlogHabit(baseHabit.id, '2026-01-05')
    expect(result.ok).toBe(true)
    expect(mockQ.softDeleteHabitLog).toHaveBeenCalledWith('log-1', expect.any(String))
  })

  it('soft-deletes log found by range', async () => {
    mockQ.getLatestLogInRange.mockResolvedValue(log)
    mockQ.softDeleteHabitLog.mockResolvedValue(undefined as any)
    const result = await unlogHabit(baseHabit.id, { fromIso: '2026-01-05T00:00:00Z', toIso: '2026-01-06T00:00:00Z' })
    expect(result.ok).toBe(true)
    expect(mockQ.softDeleteHabitLog).toHaveBeenCalled()
  })

  it('returns ok when no log found (nothing to unlog)', async () => {
    mockQ.getLatestLogInRange.mockResolvedValue(null)
    const result = await unlogHabit(baseHabit.id, '2026-01-05')
    expect(result.ok).toBe(true)
    expect(mockQ.softDeleteHabitLog).not.toHaveBeenCalled()
  })

  it('returns DB_ERROR when delete throws', async () => {
    mockQ.getLatestLogInRange.mockResolvedValue(log)
    mockQ.softDeleteHabitLog.mockRejectedValue(new Error('fail'))
    const result = await unlogHabit(baseHabit.id, '2026-01-05')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DB_ERROR')
  })
})

describe('getHabitStreak', () => {
  it('returns 0 when habit not found', async () => {
    mockQ.listLogRowsInRange.mockResolvedValue([])
    mockQ.getHabit.mockResolvedValue(null)
    const streak = await getHabitStreak(baseHabit.id)
    expect(streak).toBe(0)
  })

  it('counts consecutive completed days', async () => {
    const today = new Date()
    const d0 = new Date(today); d0.setHours(12, 0, 0, 0)
    const d1 = new Date(today); d1.setDate(d1.getDate() - 1); d1.setHours(12, 0, 0, 0)
    mockQ.listLogRowsInRange.mockResolvedValue([
      { occurred_at: d0.toISOString(), skipped: 0 },
      { occurred_at: d1.toISOString(), skipped: 0 },
    ])
    mockQ.getHabit.mockResolvedValue(baseHabit)
    const streak = await getHabitStreak(baseHabit.id)
    expect(streak).toBeGreaterThanOrEqual(2)
  })

  it('a skipped rest day bridges the streak instead of breaking it', async () => {
    const today = new Date()
    const at = (offset: number) => {
      const d = new Date(today); d.setDate(d.getDate() - offset); d.setHours(12, 0, 0, 0)
      return d.toISOString()
    }
    mockQ.listLogRowsInRange.mockResolvedValue([
      { occurred_at: at(0), skipped: 0 }, // today: done
      { occurred_at: at(1), skipped: 1 }, // yesterday: rest/skip
      { occurred_at: at(2), skipped: 0 }, // 2 days ago: done
    ])
    mockQ.getHabit.mockResolvedValue(baseHabit)
    // Two kept days, the skip in between bridges rather than breaks.
    expect(await getHabitStreak(baseHabit.id)).toBe(2)
  })

  it('returns 0 on query error', async () => {
    mockQ.listLogRowsInRange.mockRejectedValue(new Error('db fail'))
    const streak = await getHabitStreak(baseHabit.id)
    expect(streak).toBe(0)
  })
})

describe('getTodayLogCount', () => {
  it('returns count from DB', async () => {
    mockQ.countLogsInRange.mockResolvedValue(3)
    const count = await getTodayLogCount(baseHabit.id)
    expect(count).toBe(3)
  })

  it('returns 0 on error', async () => {
    mockQ.countLogsInRange.mockRejectedValue(new Error('fail'))
    const count = await getTodayLogCount(baseHabit.id)
    expect(count).toBe(0)
  })
})

describe('getCurrentPeriodLogCount', () => {
  it('returns count for daily period', async () => {
    mockQ.countLogsInRange.mockResolvedValue(1)
    const count = await getCurrentPeriodLogCount({ id: baseHabit.id, cadence: 'daily' })
    expect(count).toBe(1)
    expect(mockQ.countLogsInRange).toHaveBeenCalled()
  })

  it('returns 0 on error', async () => {
    mockQ.countLogsInRange.mockRejectedValue(new Error('fail'))
    const count = await getCurrentPeriodLogCount({ id: baseHabit.id, cadence: 'daily' })
    expect(count).toBe(0)
  })
})

describe('loadHabits error path', () => {
  it('returns DB_ERROR when listHabits throws', async () => {
    mockQ.listHabits.mockRejectedValue(new Error('connection lost'))
    const result = await loadHabits()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DB_ERROR')
  })
})

describe('computeHabitStats (batched, no DB)', () => {
  const at = (offset: number, skipped = 0) => {
    const d = new Date()
    d.setDate(d.getDate() - offset)
    d.setHours(12, 0, 0, 0)
    return { occurred_at: d.toISOString(), skipped }
  }

  it('mirrors per-habit math: skip bridges streak, counts today, no false miss', () => {
    const stats = computeHabitStats(baseHabit, [at(0, 0), at(1, 1), at(2, 0)])
    expect(stats.streak).toBe(2) // matches getHabitStreak's "skip bridges" case
    expect(stats.todayCount).toBe(1)
    expect(stats.dueToday).toBe(true)
    expect(stats.missedYesterday).toBe(false) // yesterday was a skip, not a miss
  })

  it('excludes skipped logs from todayCount', () => {
    expect(computeHabitStats(baseHabit, [at(0, 1)]).todayCount).toBe(0)
  })

  it('flags missedYesterday when due yesterday with no log at all', () => {
    expect(computeHabitStats(baseHabit, [at(0, 0)]).missedYesterday).toBe(true)
  })
})

describe('loadHabitsWithStats (batched query)', () => {
  it('uses ONE log query for the whole list and groups per habit', async () => {
    const h2: Habit = { ...baseHabit, id: 'aa11bb22-58cc-4372-a567-0e02b2c3d479', name: 'Read' }
    const now = new Date()
    now.setHours(12, 0, 0, 0)
    const log = (habit_id: string) => ({
      id: 'l', habit_id, user_id: null, occurred_at: now.toISOString(), note: null,
      skipped: 0, created_at: now.toISOString(), updated_at: now.toISOString(), deleted_at: null, synced_at: null,
    })
    mockQ.listHabits.mockResolvedValue([baseHabit, h2])
    mockQ.listLogsSince.mockResolvedValue([log(baseHabit.id), log(h2.id)])

    const r = await loadHabitsWithStats()

    expect(mockQ.listLogsSince).toHaveBeenCalledTimes(1)
    expect(mockQ.listLogRowsInRange).not.toHaveBeenCalled() // no per-habit fan-out
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value).toHaveLength(2)
      expect(r.value.find((h) => h.id === baseHabit.id)?.todayCount).toBe(1)
      expect(r.value.find((h) => h.id === h2.id)?.todayCount).toBe(1)
    }
  })
})

describe('wipeAllHabits with notifications', () => {
  it('cancels notifications for habits that have them', async () => {
    const { cancelHabitNotifications } = require('../services/notifications')
    const habitWithTimes = { ...baseHabit, notification_times: '["08:00"]' }
    mockQ.listHabits.mockResolvedValue([habitWithTimes])
    mockQ.wipeHabits.mockResolvedValue(1)
    await wipeAllHabits()
    expect(cancelHabitNotifications).toHaveBeenCalledWith(baseHabit.id)
  })
})

describe('createHabit with notification_times', () => {
  it('schedules notifications when notification_times provided', async () => {
    const { scheduleHabitNotifications } = require('../services/notifications')
    mockQ.insertHabit.mockResolvedValue(undefined as any)
    const result = await createHabit({
      name: 'Drink water',
      icon: '💧',
      color: '#2196F3',
      cadence: 'daily',
      target_per_period: 1,
      notification_times: '["08:00","20:00"]',
    })
    expect(result.ok).toBe(true)
    expect(scheduleHabitNotifications).toHaveBeenCalled()
  })
})

describe('isHabitDueOnDate', () => {
  it('daily habit is always due', () => {
    expect(isHabitDueOnDate({ cadence: 'daily', schedule_days: null }, new Date(2026, 0, 5))).toBe(true)
    expect(isHabitDueOnDate({ cadence: 'daily', schedule_days: null }, new Date(2026, 0, 11))).toBe(true)
  })

  it('weekdays habit is not due on weekends', () => {
    const saturday = new Date(2026, 0, 10) // Saturday
    const sunday = new Date(2026, 0, 11)   // Sunday
    const monday = new Date(2026, 0, 12)   // Monday
    expect(isHabitDueOnDate({ cadence: 'weekdays', schedule_days: null }, saturday)).toBe(false)
    expect(isHabitDueOnDate({ cadence: 'weekdays', schedule_days: null }, sunday)).toBe(false)
    expect(isHabitDueOnDate({ cadence: 'weekdays', schedule_days: null }, monday)).toBe(true)
  })

  it('custom habit respects schedule_days', () => {
    // Mon=1, Wed=3, Fri=5
    const habit = { cadence: 'custom' as const, schedule_days: '1,3,5' }
    expect(isHabitDueOnDate(habit, new Date(2026, 0, 5))).toBe(true)  // Monday
    expect(isHabitDueOnDate(habit, new Date(2026, 0, 6))).toBe(false) // Tuesday
    expect(isHabitDueOnDate(habit, new Date(2026, 0, 7))).toBe(true)  // Wednesday
  })

  it('custom habit with empty schedule_days defaults to always due', () => {
    expect(isHabitDueOnDate({ cadence: 'custom', schedule_days: '' }, new Date(2026, 0, 11))).toBe(true)
  })
})

describe('habit period helpers', () => {
  it('formats dates using the local calendar day', () => {
    expect(getLocalDateString(new Date(2026, 0, 5, 6, 0, 0))).toBe('2026-01-05')
  })

  it('resets daily habits at local midnight', () => {
    const range = getHabitPeriodRange({ cadence: 'daily' }, new Date(2026, 0, 5, 6, 0, 0))
    expect(range.from).toEqual(new Date(2026, 0, 5, 0, 0, 0, 0))
    expect(range.to).toEqual(new Date(2026, 0, 6, 0, 0, 0, 0))
  })

  it('resets weekly habits on Monday', () => {
    const range = getHabitPeriodRange({ cadence: 'weekly' }, new Date(2026, 0, 7, 6, 0, 0))
    expect(range.from).toEqual(new Date(2026, 0, 5, 0, 0, 0, 0))
    expect(range.to).toEqual(new Date(2026, 0, 12, 0, 0, 0, 0))
  })

  it('resets monthly habits on the first day of the month', () => {
    const range = getHabitPeriodRange({ cadence: 'monthly' }, new Date(2026, 0, 20, 6, 0, 0))
    expect(range.from).toEqual(new Date(2026, 0, 1, 0, 0, 0, 0))
    expect(range.to).toEqual(new Date(2026, 1, 1, 0, 0, 0, 0))
  })
})

describe('local-date bucketing (timezone correctness, H1)', () => {
  it('localDayBoundsIso spans exactly one local calendar day', () => {
    const { fromIso, toIso } = localDayBoundsIso('2026-01-05')
    expect(new Date(fromIso)).toEqual(new Date(2026, 0, 5, 0, 0, 0, 0))
    expect(new Date(toIso)).toEqual(new Date(2026, 0, 6, 0, 0, 0, 0))
  })

  it('buckets a log onto its LOCAL calendar day (not the UTC substring)', () => {
    // 06:00 and 23:30 local on Jan 5. East of UTC the ISO string can carry a
    // different (UTC) date — bucketing must still resolve to the local day.
    const localMorning = new Date(2026, 0, 5, 6, 0, 0)
    const { doneByDate, skippedDates } = bucketLogsByLocalDate([
      { occurred_at: localMorning.toISOString(), skipped: 0 },
      { occurred_at: new Date(2026, 0, 5, 23, 30, 0).toISOString(), skipped: 1 },
    ])
    expect(doneByDate.get(getLocalDateString(localMorning))).toBe(1)
    expect(doneByDate.get('2026-01-05')).toBe(1)
    expect(skippedDates.has('2026-01-05')).toBe(true)
  })
})

describe('wasHabitMissedYesterday', () => {
  const skipLog = {
    id: 'log-skip', habit_id: baseHabit.id, user_id: null,
    occurred_at: '2026-01-04T12:00:00.000Z', note: 'Skipped', skipped: 1,
    created_at: '2026-01-04T00:00:00.000Z', updated_at: '2026-01-04T00:00:00.000Z',
    deleted_at: null, synced_at: null,
  }
  const doneLog = { ...skipLog, id: 'log-done', note: null, skipped: 0 }

  it('is a miss when scheduled yesterday and there is no log', async () => {
    mockQ.getLatestLogInRange.mockResolvedValue(null)
    expect(await wasHabitMissedYesterday(baseHabit)).toBe(true)
  })

  it('is NOT a miss when yesterday was completed', async () => {
    mockQ.getLatestLogInRange.mockResolvedValue(doneLog)
    expect(await wasHabitMissedYesterday(baseHabit)).toBe(false)
  })

  it('is NOT a miss when yesterday was intentionally skipped', async () => {
    mockQ.getLatestLogInRange.mockResolvedValue(skipLog)
    expect(await wasHabitMissedYesterday(baseHabit)).toBe(false)
  })

  it('is NOT a miss when the habit was not scheduled yesterday', async () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    // Schedule only a weekday that is NOT yesterday → not due yesterday.
    const otherWeekday = String((yesterday.getDay() + 1) % 7)
    const habit = { ...baseHabit, cadence: 'custom' as const, schedule_days: otherWeekday }
    expect(await wasHabitMissedYesterday(habit)).toBe(false)
    expect(mockQ.getLatestLogInRange).not.toHaveBeenCalled()
  })

  it('returns false on query error', async () => {
    mockQ.getLatestLogInRange.mockRejectedValue(new Error('db fail'))
    expect(await wasHabitMissedYesterday(baseHabit)).toBe(false)
  })
})

describe('buildImplementationIntention', () => {
  const t = {
    impl_intention_full: 'At {{time}}, at {{place}}, I will {{habit}}.',
    impl_intention_time: 'I will {{habit}} at {{time}}.',
    impl_intention_place: 'I will {{habit}} in {{place}}.',
  }

  it('uses the full template when both time and place exist', () => {
    const r = buildImplementationIntention(
      { name: 'Run', notification_times: '["06:30","21:00"]', location_label: 'the park' },
      t
    )
    expect(r).toBe('At 06:30, at the park, I will Run.')
  })

  it('uses the time-only template when there is no place', () => {
    const r = buildImplementationIntention(
      { name: 'Run', notification_times: '["06:30"]', location_label: null },
      t
    )
    expect(r).toBe('I will Run at 06:30.')
  })

  it('uses the place-only template when there is no time', () => {
    const r = buildImplementationIntention(
      { name: 'Run', notification_times: null, location_label: 'the park' },
      t
    )
    expect(r).toBe('I will Run in the park.')
  })

  it('returns null when neither time nor place is set', () => {
    expect(buildImplementationIntention({ name: 'Run', notification_times: null, location_label: null }, t)).toBeNull()
    expect(buildImplementationIntention({ name: 'Run', notification_times: '[]', location_label: '' }, t)).toBeNull()
  })

  it('returns null for an empty name', () => {
    expect(buildImplementationIntention({ name: '  ', notification_times: '["06:30"]', location_label: null }, t)).toBeNull()
  })

  it('tolerates malformed notification_times JSON', () => {
    const r = buildImplementationIntention({ name: 'Run', notification_times: 'not-json', location_label: 'gym' }, t)
    expect(r).toBe('I will Run in gym.')
  })
})
