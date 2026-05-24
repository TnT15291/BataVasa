const mockDb = {
  runAsync: jest.fn(),
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
}

jest.mock('../database/core/db', () => ({
  getDb: jest.fn(() => Promise.resolve(mockDb)),
}))

import {
  exportJournalsData,
  getJournal,
  insertJournal,
  listJournals,
  softDeleteJournal,
  updateJournal,
  wipeJournals,
} from '../database/journals/queries'
import type { Journal } from '../features/journals/types'

const baseJournal: Journal = {
  id: 'journal-1',
  user_id: 'user-1',
  content: 'A meaningful day',
  mood: 4,
  is_important: 0,
  occurred_at: '2026-01-02T21:00:00.000Z',
  location_lat: null,
  location_lng: null,
  location_label: null,
  created_at: '2026-01-02T21:00:00.000Z',
  updated_at: '2026-01-02T21:00:00.000Z',
  deleted_at: null,
  synced_at: null,
}

beforeEach(() => jest.clearAllMocks())

describe('journal queries', () => {
  it('inserts journal with nullable fields', async () => {
    await insertJournal({ ...baseJournal, mood: null })
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO journal'),
      expect.arrayContaining(['journal-1', 'user-1', 'A meaningful day', null, '2026-01-02T21:00:00.000Z'])
    )
  })

  it('updates journal fields and no-ops empty patch', async () => {
    await updateJournal('journal-1', { content: 'Updated', mood: 5, id: 'ignored' } as any)
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE journal SET content = ?, mood = ? WHERE id = ?'),
      ['Updated', 5, 'journal-1']
    )

    mockDb.runAsync.mockClear()
    await updateJournal('journal-1', { id: 'ignored' } as any)
    expect(mockDb.runAsync).not.toHaveBeenCalled()
  })

  it('soft-deletes, gets, lists, wipes, and exports journals', async () => {
    mockDb.getFirstAsync.mockResolvedValue(baseJournal)
    mockDb.getAllAsync.mockResolvedValue([baseJournal])
    mockDb.runAsync.mockResolvedValue({ changes: 2 })

    await softDeleteJournal('journal-1', '2026-01-03T00:00:00.000Z')
    await expect(getJournal('journal-1', 'user-1')).resolves.toBe(baseJournal)
    await expect(listJournals('user-1')).resolves.toEqual([baseJournal])
    await expect(wipeJournals('user-1')).resolves.toBe(2)
    await expect(exportJournalsData('user-1')).resolves.toEqual([baseJournal])

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('deleted_at = ?'),
      ['2026-01-03T00:00:00.000Z', '2026-01-03T00:00:00.000Z', 'journal-1']
    )
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('user_id = ?'), ['user-1'])
    expect(mockDb.runAsync).toHaveBeenCalledWith('DELETE FROM journal WHERE user_id = ?', ['user-1'])
  })
})
