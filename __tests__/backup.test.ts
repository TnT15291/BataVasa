jest.mock('../features/finance/services', () => ({ exportAllData: jest.fn() }))
jest.mock('../features/habits/services', () => ({ exportAllHabits: jest.fn() }))
jest.mock('../features/journals/services', () => ({ exportAllJournals: jest.fn() }))
jest.mock('../features/reminders/services', () => ({ exportAllReminders: jest.fn() }))
jest.mock('../features/goals/services', () => ({ exportAllGoals: jest.fn() }))
jest.mock('../features/context/services', () => ({ exportAllContext: jest.fn() }))

import { exportAllData } from '../features/finance/services'
import { exportAllHabits } from '../features/habits/services'
import { exportAllJournals } from '../features/journals/services'
import { exportAllReminders } from '../features/reminders/services'
import { exportAllGoals } from '../features/goals/services'
import { exportAllContext } from '../features/context/services'
import { createBackupFile } from '../services/backup'

const mockFinance = exportAllData as jest.Mock
const mockHabits = exportAllHabits as jest.Mock
const mockJournals = exportAllJournals as jest.Mock
const mockReminders = exportAllReminders as jest.Mock
const mockGoals = exportAllGoals as jest.Mock
const mockContext = exportAllContext as jest.Mock

describe('backup service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFinance.mockResolvedValue({ ok: true, value: JSON.stringify({ exported_at: 'old', transactions: [{ id: 'tx1' }], categories: [{ id: 'cat1' }] }) })
    mockHabits.mockResolvedValue({ ok: true, value: JSON.stringify({ exported_at: 'old', habits: [{ id: 'h1' }], logs: [{ id: 'l1' }] }) })
    mockJournals.mockResolvedValue({ ok: true, value: JSON.stringify({ exported_at: 'old', journals: [{ id: 'j1' }] }) })
    mockReminders.mockResolvedValue({ ok: true, value: JSON.stringify({ exported_at: 'old', reminders: [{ id: 'r1' }] }) })
    mockGoals.mockResolvedValue({ ok: true, value: JSON.stringify({ exported_at: 'old', goals: [{ id: 'g1' }] }) })
    mockContext.mockResolvedValue({ ok: true, value: JSON.stringify({ exported_at: 'old', user_context: [{ id: 'c1' }] }) })
  })

  it('creates one versioned backup file with every exported module', async () => {
    const result = await createBackupFile()

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.fileName).toMatch(/^batavasa-backup-.*\.json$/)
    expect(result.value.recordCount).toBe(8)

    const payload = JSON.parse(result.value.json)
    expect(payload.app).toBe('BataVasa')
    expect(payload.version).toBe(1)
    expect(payload.modules.finance.transactions).toHaveLength(1)
    expect(payload.modules.finance.exported_at).toBeUndefined()
    expect(payload.modules.habits.logs).toHaveLength(1)
    expect(payload.modules.journals.journals).toHaveLength(1)
    expect(payload.modules.reminders.reminders).toHaveLength(1)
    expect(payload.modules.goals.goals).toHaveLength(1)
    expect(payload.modules.user_context.user_context).toHaveLength(1)
  })

  it('returns the first module export error', async () => {
    mockJournals.mockResolvedValue({ ok: false, error: { code: 'DB_ERROR', message: 'journal export failed' } })

    const result = await createBackupFile()

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toBe('journal export failed')
  })
})
