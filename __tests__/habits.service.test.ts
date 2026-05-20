jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }))

jest.mock('../database/habits/queries', () => ({
  insertHabit: jest.fn(),
  updateHabit: jest.fn(),
  getHabit: jest.fn(),
  softDeleteHabit: jest.fn(),
  listHabits: jest.fn(),
  wipeHabits: jest.fn(),
  exportHabitsData: jest.fn(),
  insertHabitLog: jest.fn(),
  getLogForDate: jest.fn(),
  softDeleteHabitLog: jest.fn(),
  countLogsForDate: jest.fn(),
  listLogCountsByDate: jest.fn(),
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

import * as q from '../database/habits/queries'
import { createHabit, loadHabits, deleteHabit, wipeAllHabits, logHabit } from '../features/habits/services'
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
