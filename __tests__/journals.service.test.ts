// Mock expo-sqlite before importing anything that uses it
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}))

// Mock the DB queries module
jest.mock('../database/journals/queries', () => ({
  insertJournal: jest.fn(),
  updateJournal: jest.fn(),
  getJournal: jest.fn(),
  softDeleteJournal: jest.fn(),
  listJournals: jest.fn(),
  wipeJournals: jest.fn(),
  exportJournalsData: jest.fn(),
}))

// Mock the core DB (nowIso)
jest.mock('../database/core/db', () => ({
  nowIso: () => '2026-01-01T00:00:00.000Z',
  getDB: jest.fn(),
}))

// Mock uuid
jest.mock('../services/uuid', () => ({
  uuid: () => 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
}))

// Mock identity (avoids pulling in the Supabase/auth-store import chain)
jest.mock('../services/identity', () => ({ getCurrentUserId: () => null }))

// Mock logger
jest.mock('../services/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import * as q from '../database/journals/queries'
import { createJournal, updateJournal, deleteJournal, loadJournals, wipeAllJournals } from '../features/journals/services'
import type { Journal } from '../features/journals/types'

const mockQ = q as jest.Mocked<typeof q>

const baseJournal: Journal = {
  id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  user_id: null,
  content: 'Had a great day',
  mood: 4,
  is_important: 0,
  occurred_at: '2026-01-01T10:00:00.000Z',
  location_lat: null,
  location_lng: null,
  location_label: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  synced_at: null,
}

beforeEach(() => jest.resetAllMocks())

describe('createJournal', () => {
  it('creates a journal and returns it', async () => {
    mockQ.insertJournal.mockResolvedValue(undefined as any)

    const result = await createJournal({
      content: 'Had a great day',
      mood: 4,
      occurred_at: '2026-01-01T10:00:00.000Z',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.content).toBe('Had a great day')
      expect(result.value.mood).toBe(4)
      expect(result.value.id).toBe('f47ac10b-58cc-4372-a567-0e02b2c3d479')
    }
    expect(mockQ.insertJournal).toHaveBeenCalledTimes(1)
  })

  it('returns VALIDATION_FAILED for empty content', async () => {
    const result = await createJournal({
      content: '',
      occurred_at: '2026-01-01T10:00:00.000Z',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_FAILED')
  })

  it('returns VALIDATION_FAILED for invalid mood (>5)', async () => {
    const result = await createJournal({
      content: 'test',
      mood: 6,
      occurred_at: '2026-01-01T10:00:00.000Z',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_FAILED')
  })

  it('returns DB_ERROR when insert throws', async () => {
    mockQ.insertJournal.mockRejectedValue(new Error('disk full'))
    const result = await createJournal({
      content: 'test entry',
      occurred_at: '2026-01-01T10:00:00.000Z',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DB_ERROR')
  })
})

describe('updateJournal', () => {
  it('updates content and returns updated journal', async () => {
    mockQ.getJournal.mockResolvedValueOnce(baseJournal).mockResolvedValueOnce({
      ...baseJournal, content: 'Updated content',
    })
    mockQ.updateJournal.mockResolvedValue(undefined as any)

    const result = await updateJournal({ id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', content: 'Updated content' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.content).toBe('Updated content')
  })

  it('returns NOT_FOUND when journal does not exist', async () => {
    mockQ.getJournal.mockResolvedValue(null)
    const result = await updateJournal({ id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', content: 'test' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
  })
})

describe('deleteJournal', () => {
  it('soft-deletes existing journal', async () => {
    mockQ.getJournal.mockResolvedValue(baseJournal)
    mockQ.softDeleteJournal.mockResolvedValue(undefined as any)
    const result = await deleteJournal('f47ac10b-58cc-4372-a567-0e02b2c3d479')
    expect(result.ok).toBe(true)
    expect(mockQ.softDeleteJournal).toHaveBeenCalledWith('f47ac10b-58cc-4372-a567-0e02b2c3d479', expect.any(String))
  })

  it('returns NOT_FOUND for nonexistent id', async () => {
    mockQ.getJournal.mockResolvedValue(null)
    const result = await deleteJournal('nope')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND')
  })
})

describe('loadJournals', () => {
  it('returns array of journals', async () => {
    mockQ.listJournals.mockResolvedValue([baseJournal])
    const result = await loadJournals()
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toHaveLength(1)
  })

  it('returns DB_ERROR when query throws', async () => {
    mockQ.listJournals.mockRejectedValue(new Error('db locked'))
    const result = await loadJournals()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DB_ERROR')
  })
})

describe('wipeAllJournals', () => {
  it('returns deleted count', async () => {
    mockQ.wipeJournals.mockResolvedValue(5)
    const result = await wipeAllJournals()
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.deleted).toBe(5)
  })
})
