const mockDb = {
  runAsync: jest.fn(),
  getFirstAsync: jest.fn(),
}

const mockDelete = jest.fn()
const mockEq = jest.fn()
const mockUpsert = jest.fn()
const mockFrom = jest.fn()
const mockAppStateAddEventListener = jest.fn()
const mockGetPending = jest.fn()
const mockMarkSynced = jest.fn()
const mockMarkFailed = jest.fn()
const mockAuthGetState = jest.fn()
const mockSettingsGetState = jest.fn()
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}

const queueItem = {
  id: 'q1',
  table_name: 'reminder',
  row_id: 'rem-1',
  operation: 'upsert' as const,
  created_at: '2026-01-01T00:00:00.000Z',
  retry_count: 0,
  last_error: null,
}

function loadSync() {
  jest.resetModules()
  jest.doMock('react-native', () => ({
    AppState: {
      addEventListener: mockAppStateAddEventListener,
    },
  }))
  jest.doMock('../services/supabase', () => ({ supabase: { from: mockFrom } }))
  jest.doMock('@services/supabase', () => ({ supabase: { from: mockFrom } }))
  jest.doMock('../services/logger', () => ({ logger: mockLogger }))
  jest.doMock('@services/logger', () => ({ logger: mockLogger }))
  jest.doMock('@db/core/db', () => ({
    getDb: jest.fn(() => Promise.resolve(mockDb)),
    nowIso: () => '2026-01-01T00:00:00.000Z',
  }))
  jest.doMock('../database/core/db', () => ({
    getDb: jest.fn(() => Promise.resolve(mockDb)),
    nowIso: () => '2026-01-01T00:00:00.000Z',
  }))
  jest.doMock('@db/sync/queue', () => ({
    getPending: mockGetPending,
    markSynced: mockMarkSynced,
    markFailed: mockMarkFailed,
  }))
  jest.doMock('../database/sync/queue', () => ({
    getPending: mockGetPending,
    markSynced: mockMarkSynced,
    markFailed: mockMarkFailed,
  }))
  jest.doMock('@store/authStore', () => ({
    useAuthStore: {
      getState: mockAuthGetState,
    },
  }))
  jest.doMock('../store/authStore', () => ({
    useAuthStore: {
      getState: mockAuthGetState,
    },
  }))
  jest.doMock('@store/settingsStore', () => ({
    useSettingsStore: {
      getState: mockSettingsGetState,
    },
  }))
  jest.doMock('../store/settingsStore', () => ({
    useSettingsStore: {
      getState: mockSettingsGetState,
    },
  }))
  return require('../services/sync') as typeof import('../services/sync')
}

beforeEach(() => {
  jest.clearAllMocks()
  mockAuthGetState.mockReturnValue({ session: { user: { id: 'user-1' } } })
  mockSettingsGetState.mockReturnValue({
    syncFinance: true,
    syncHabits: true,
    syncJournals: true,
    syncReminders: true,
  })
  mockGetPending.mockResolvedValue([])
  mockDb.getFirstAsync.mockResolvedValue({ id: 'rem-1', title: 'Call mom' })
  mockDb.runAsync.mockResolvedValue(undefined)
  mockUpsert.mockResolvedValue({ error: null })
  mockEq.mockResolvedValue({ error: null })
  mockDelete.mockReturnValue({ eq: mockEq })
  mockFrom.mockReturnValue({ upsert: mockUpsert, delete: mockDelete })
  mockAppStateAddEventListener.mockReturnValue({ remove: jest.fn() })
})

describe('sync worker', () => {
  it('does not drain without an auth session', async () => {
    const { drainQueue } = loadSync()
    mockAuthGetState.mockReturnValueOnce({ session: null })

    await drainQueue()

    expect(mockGetPending).not.toHaveBeenCalled()
  })

  it('upserts local rows with the current user id and marks them synced', async () => {
    const { drainQueue } = loadSync()
    mockGetPending.mockResolvedValueOnce([queueItem])

    await drainQueue()

    expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
      'SELECT * FROM reminder WHERE id = ?',
      ['rem-1']
    )
    expect(mockFrom).toHaveBeenCalledWith('reminder')
    expect(mockUpsert).toHaveBeenCalledWith(
      { id: 'rem-1', title: 'Call mom', user_id: 'user-1' },
      { onConflict: 'id' }
    )
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'UPDATE reminder SET synced_at = ? WHERE id = ?',
      ['2026-01-01T00:00:00.000Z', 'rem-1']
    )
    expect(mockMarkSynced).toHaveBeenCalledWith('q1')
  })

  it('marks missing local rows as synced without pushing', async () => {
    const { drainQueue } = loadSync()
    mockGetPending.mockResolvedValueOnce([queueItem])
    mockDb.getFirstAsync.mockResolvedValueOnce(null)

    await drainQueue()

    expect(mockUpsert).not.toHaveBeenCalled()
    expect(mockMarkSynced).toHaveBeenCalledWith('q1')
  })

  it('skips items when their module sync toggle is disabled', async () => {
    const { drainQueue } = loadSync()
    mockGetPending.mockResolvedValueOnce([queueItem])
    mockSettingsGetState.mockReturnValueOnce({
      syncFinance: true,
      syncHabits: true,
      syncJournals: true,
      syncReminders: false,
    })

    await drainQueue()

    expect(mockDb.getFirstAsync).not.toHaveBeenCalled()
    expect(mockMarkSynced).not.toHaveBeenCalled()
    expect(mockMarkFailed).not.toHaveBeenCalled()
  })

  it('deletes remote rows for wipe operations', async () => {
    const { drainQueue } = loadSync()
    mockGetPending.mockResolvedValueOnce([{ ...queueItem, operation: 'wipe' as const, row_id: 'ALL' }])

    await drainQueue()

    expect(mockFrom).toHaveBeenCalledWith('reminder')
    expect(mockDelete).toHaveBeenCalled()
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(mockMarkSynced).toHaveBeenCalledWith('q1')
  })

  it('marks failed items when Supabase returns an error', async () => {
    const { drainQueue } = loadSync()
    mockGetPending.mockResolvedValueOnce([queueItem])
    mockUpsert.mockResolvedValueOnce({ error: new Error('offline') })

    await drainQueue()

    expect(mockMarkFailed).toHaveBeenCalledWith('q1', 'Error: offline')
    expect(mockLogger.warn).toHaveBeenCalledWith('sync', 'item failed', expect.any(Object))
  })

  it('starts a worker and unsubscribes from app-state changes', () => {
    const { startSyncWorker } = loadSync()

    const unsubscribe = startSyncWorker()

    expect(mockAppStateAddEventListener).toHaveBeenCalledWith('change', expect.any(Function))

    const listener = mockAppStateAddEventListener.mock.calls[0][1]
    listener('active')
    const subscription = mockAppStateAddEventListener.mock.results[0].value
    unsubscribe()

    expect(subscription.remove).toHaveBeenCalled()
  })
})
