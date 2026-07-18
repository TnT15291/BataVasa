const mockDb = { runAsync: jest.fn(), getFirstAsync: jest.fn(), getAllAsync: jest.fn() }
jest.mock('../database/core/db', () => ({ getDb: jest.fn(() => Promise.resolve(mockDb)) }))

import * as queries from '../database/context/queries'
import type { UserContextEntry } from '../features/context/types'

const entry: UserContextEntry = {
  id: 'context-1', user_id: 'user-1', kind: 'preference', content: 'Prefer concise advice', pinned: 1,
  created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null, synced_at: null,
}

beforeEach(() => jest.clearAllMocks())

describe('context queries', () => {
  it('inserts all context fields', async () => {
    await queries.insertContext(entry)
    expect(mockDb.runAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO user_context'), expect.arrayContaining(['context-1', 'user-1', 'preference', 'Prefer concise advice', 1]))
  })

  it('updates nullable fields and ignores an id-only patch', async () => {
    await queries.updateContext(entry.id, { content: 'Updated', pinned: 0, id: 'ignored' } as any)
    expect(mockDb.runAsync).toHaveBeenCalledWith(expect.stringContaining('content = ?, pinned = ?'), ['Updated', 0, entry.id])
    mockDb.runAsync.mockClear()
    await queries.updateContext(entry.id, { id: 'ignored' } as any)
    expect(mockDb.runAsync).not.toHaveBeenCalled()
  })

  it('gets, lists, deletes, restores, wipes, and exports by user', async () => {
    mockDb.getFirstAsync.mockResolvedValue(entry)
    mockDb.getAllAsync.mockResolvedValue([entry])
    mockDb.runAsync.mockResolvedValue({ changes: 3 })
    await expect(queries.getContext(entry.id, 'user-1')).resolves.toBe(entry)
    await expect(queries.getContextIncludingDeleted(entry.id, 'user-1')).resolves.toBe(entry)
    await expect(queries.listContext('user-1')).resolves.toEqual([entry])
    await queries.softDeleteContext(entry.id, 'deleted-at')
    await queries.restoreContext(entry.id, 'restored-at')
    await expect(queries.wipeContext('user-1')).resolves.toBe(3)
    await expect(queries.exportContextData('user-1')).resolves.toEqual([entry])
    expect(mockDb.runAsync).toHaveBeenCalledWith('DELETE FROM user_context WHERE user_id = ?', ['user-1'])
  })
})
