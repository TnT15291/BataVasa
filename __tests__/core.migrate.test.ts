const mockDb = {
  execAsync: jest.fn(),
  getFirstAsync: jest.fn(),
}

const mockGetDb = jest.fn()
const mockInitFinanceSchema = jest.fn()
const mockInitSettingsSchema = jest.fn()
const mockCreateReminderSchema = jest.fn()
const mockCreateJournalSchema = jest.fn()
const mockCreateHabitSchema = jest.fn()
const mockCreateSyncQueueSchema = jest.fn()
const mockLogger = {
  info: jest.fn(),
}

function loadMigrations() {
  jest.resetModules()
  jest.doMock('../database/core/db', () => ({ getDb: mockGetDb }))
  jest.doMock('@db/core/db', () => ({ getDb: mockGetDb }))
  jest.doMock('../database/finance/schema', () => ({ initFinanceSchema: mockInitFinanceSchema }))
  jest.doMock('../database/settings/schema', () => ({ initSettingsSchema: mockInitSettingsSchema }))
  jest.doMock('../database/reminders/schema', () => ({ createReminderSchema: mockCreateReminderSchema }))
  jest.doMock('../database/journals/schema', () => ({ createJournalSchema: mockCreateJournalSchema }))
  jest.doMock('../database/habits/schema', () => ({ createHabitSchema: mockCreateHabitSchema }))
  jest.doMock('../database/sync/schema', () => ({ createSyncQueueSchema: mockCreateSyncQueueSchema }))
  jest.doMock('@services/logger', () => ({ logger: mockLogger }))
  jest.doMock('../services/logger', () => ({ logger: mockLogger }))
  return require('../database/core/migrate') as typeof import('../database/core/migrate')
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetDb.mockResolvedValue(mockDb)
  mockDb.getFirstAsync.mockResolvedValue({ user_version: 0 })
  mockDb.execAsync.mockResolvedValue(undefined)
})

describe('core migrations', () => {
  it('applies all migrations on a fresh database and bumps user_version after each one', async () => {
    const { runMigrations } = loadMigrations()

    await runMigrations()

    expect(mockInitFinanceSchema).toHaveBeenCalledWith(mockDb)
    expect(mockInitSettingsSchema).toHaveBeenCalledWith(mockDb)
    expect(mockCreateReminderSchema).toHaveBeenCalledWith(mockDb)
    expect(mockCreateJournalSchema).toHaveBeenCalledWith(mockDb)
    expect(mockCreateHabitSchema).toHaveBeenCalledWith(mockDb)
    expect(mockCreateSyncQueueSchema).toHaveBeenCalledWith(mockDb)
    expect(mockDb.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 12')
    expect(mockLogger.info).toHaveBeenCalledWith('migrate', 'applied v12')
  })

  it('resumes from the stored user_version instead of replaying earlier migrations', async () => {
    const { runMigrations } = loadMigrations()
    mockDb.getFirstAsync.mockResolvedValueOnce({ user_version: 10 })

    await runMigrations()

    expect(mockInitFinanceSchema).not.toHaveBeenCalled()
    expect(mockCreateReminderSchema).not.toHaveBeenCalled()
    expect(mockDb.execAsync).toHaveBeenCalledWith(
      "ALTER TABLE reminder ADD COLUMN is_inbox INTEGER NOT NULL DEFAULT 0"
    )
    expect(mockDb.execAsync).toHaveBeenCalledWith('ALTER TABLE habit ADD COLUMN schedule_days TEXT')
    expect(mockDb.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 11')
    expect(mockDb.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 12')
  })

  it('ignores duplicate column errors so additive migrations stay idempotent', async () => {
    const { runMigrations } = loadMigrations()
    mockDb.getFirstAsync.mockResolvedValueOnce({ user_version: 10 })
    mockDb.execAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('is_inbox')) throw new Error('duplicate column name: is_inbox')
    })

    await runMigrations()

    expect(mockDb.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 11')
    expect(mockDb.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 12')
  })

  it('reuses the in-flight migration promise', async () => {
    const { runMigrations } = loadMigrations()

    await Promise.all([runMigrations(), runMigrations()])

    expect(mockGetDb).toHaveBeenCalledTimes(1)
    expect(mockDb.getFirstAsync).toHaveBeenCalledTimes(1)
  })
})
