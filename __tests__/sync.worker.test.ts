const mockDb = {
  runAsync: jest.fn(),
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
}

const mockDelete = jest.fn()
const mockEq = jest.fn()
const mockUpsert = jest.fn()
const mockSelect = jest.fn()
const mockPullEq = jest.fn()
const mockOrder = jest.fn()
const mockLimit = jest.fn()
const mockFrom = jest.fn()
const mockAppStateAddEventListener = jest.fn()
const mockGetPending = jest.fn()
const mockMarkSynced = jest.fn()
const mockMarkFailed = jest.fn()
const mockPurgeFailed = jest.fn()
const mockAuthGetState = jest.fn()
const mockSettingsGetState = jest.fn()
const mockLoadCategories = jest.fn()
const mockLoadTransactions = jest.fn()
const mockLoadHabits = jest.fn()
const mockLoadJournals = jest.fn()
const mockLoadReminders = jest.fn()
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
    purgeFailed: mockPurgeFailed,
  }))
  jest.doMock('../database/sync/queue', () => ({
    getPending: mockGetPending,
    markSynced: mockMarkSynced,
    markFailed: mockMarkFailed,
    purgeFailed: mockPurgeFailed,
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
  jest.doMock('@store/financeStore', () => ({
    useFinanceStore: {
      getState: () => ({
        loadCategories: mockLoadCategories,
        loadTransactions: mockLoadTransactions,
      }),
    },
  }))
  jest.doMock('@store/habitsStore', () => ({
    useHabitsStore: {
      getState: () => ({ loadHabits: mockLoadHabits }),
    },
  }))
  jest.doMock('@store/journalsStore', () => ({
    useJournalsStore: {
      getState: () => ({ loadJournals: mockLoadJournals }),
    },
  }))
  jest.doMock('@store/remindersStore', () => ({
    useRemindersStore: {
      getState: () => ({ loadReminders: mockLoadReminders }),
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
  mockPurgeFailed.mockResolvedValue(undefined)
  mockDb.getFirstAsync.mockResolvedValue({ id: 'rem-1', title: 'Call mom' })
  mockDb.getAllAsync.mockResolvedValue([{ name: 'id' }, { name: 'title' }, { name: 'updated_at' }, { name: 'synced_at' }])
  mockDb.runAsync.mockResolvedValue(undefined)
  mockUpsert.mockResolvedValue({ error: null })
  mockEq.mockResolvedValue({ error: null })
  mockDelete.mockReturnValue({ eq: mockEq })
  mockLimit.mockResolvedValue({ data: [], error: null })
  mockOrder.mockReturnValue({ limit: mockLimit })
  mockPullEq.mockReturnValue({ order: mockOrder })
  mockSelect.mockReturnValue({ eq: mockPullEq })
  mockFrom.mockReturnValue({ upsert: mockUpsert, delete: mockDelete, select: mockSelect })
  mockAppStateAddEventListener.mockReturnValue({ remove: jest.fn() })
  mockLoadCategories.mockResolvedValue(undefined)
  mockLoadTransactions.mockResolvedValue(undefined)
  mockLoadHabits.mockResolvedValue(undefined)
  mockLoadJournals.mockResolvedValue(undefined)
  mockLoadReminders.mockResolvedValue(undefined)
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

  it('pulls remote rows into SQLite and refreshes loaded stores', async () => {
    const { pullRemoteData } = loadSync()
    mockDb.getFirstAsync.mockResolvedValueOnce(null)
    mockLimit
      .mockResolvedValueOnce({
        data: [{ id: 'tx-1', amount_cents: -25000, updated_at: '2026-01-02T00:00:00.000Z' }],
        error: null,
      })
      .mockResolvedValue({ data: [], error: null })

    await pullRemoteData()

    expect(mockFrom).toHaveBeenCalledWith('finance_transaction')
    expect(mockSelect).toHaveBeenCalledWith('*')
    expect(mockPullEq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO finance_transaction'),
      ['tx-1', '2026-01-02T00:00:00.000Z', '2026-01-01T00:00:00.000Z']
    )
    expect(mockLoadCategories).toHaveBeenCalled()
    expect(mockLoadTransactions).toHaveBeenCalled()
    expect(mockLoadHabits).toHaveBeenCalled()
    expect(mockLoadJournals).toHaveBeenCalled()
    expect(mockLoadReminders).toHaveBeenCalled()
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
