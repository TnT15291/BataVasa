const mockDb = {
  runAsync: jest.fn(),
  getAllAsync: jest.fn(),
}

jest.mock('../database/core/db', () => ({
  getDb: jest.fn(() => Promise.resolve(mockDb)),
  nowIso: () => '2026-01-01T00:00:00.000Z',
}))

jest.mock('../services/uuid', () => ({ uuid: () => 'queue-id-1' }))
jest.mock('../services/logger', () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }))

import { clearAll, enqueue, getPending, markFailed, markSynced, purgeFailed } from '../database/sync/queue'
import { logger } from '../services/logger'

beforeEach(() => jest.clearAllMocks())

describe('sync queue', () => {
  it('deduplicates upserts with insert or replace', async () => {
    await enqueue('reminder', 'rem-1', 'upsert')

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO sync_queue'),
      ['queue-id-1', 'reminder', 'rem-1', '2026-01-01T00:00:00.000Z']
    )
  })

  it('enqueues wipe operations with ALL row id', async () => {
    await enqueue('journal', 'ignored', 'wipe')

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("VALUES (?, ?, 'ALL', 'wipe', ?)"),
      ['queue-id-1', 'journal', '2026-01-01T00:00:00.000Z']
    )
  })

  it('loads pending items under retry limit', async () => {
    const rows = [{ id: 'q1', table_name: 'reminder', row_id: 'r1', operation: 'upsert', created_at: 'now', retry_count: 0, last_error: null }]
    mockDb.getAllAsync.mockResolvedValue(rows)

    await expect(getPending(10)).resolves.toBe(rows)
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('WHERE retry_count < ? ORDER BY created_at ASC LIMIT ?'),
      [3, 10]
    )
  })

  it('marks synced, failed, and clears queue', async () => {
    await markSynced('q1')
    await markFailed('q2', 'x'.repeat(600))
    await clearAll()

    expect(mockDb.runAsync).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM sync_queue WHERE id = ?'), ['q1'])
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE sync_queue SET retry_count = retry_count + 1'),
      ['x'.repeat(500), 'q2']
    )
    expect(mockDb.runAsync).toHaveBeenCalledWith('DELETE FROM sync_queue')
  })

  it('logs enqueue failures without throwing', async () => {
    mockDb.runAsync.mockRejectedValueOnce(new Error('db locked'))

    await expect(enqueue('reminder', 'rem-1', 'upsert')).resolves.toBeUndefined()
    expect(logger.warn).toHaveBeenCalledWith('sync.queue', 'enqueue failed', expect.objectContaining({
      table_name: 'reminder',
      operation: 'upsert',
    }))
  })

  it('logs wipe enqueue failures without throwing', async () => {
    mockDb.runAsync.mockRejectedValueOnce(new Error('db locked'))
    await expect(enqueue('journal', 'ALL', 'wipe')).resolves.toBeUndefined()
    expect(logger.warn).toHaveBeenCalledWith('sync.queue', 'enqueue failed', expect.objectContaining({
      operation: 'wipe',
    }))
  })

  it('purges failed items over max retry limit', async () => {
    await purgeFailed()
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM sync_queue WHERE retry_count >='),
      [3]
    )
  })

  it('getPending uses default limit of 50 when called without arguments', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([])
    await getPending()
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT ?'),
      [3, 50]
    )
  })
})
