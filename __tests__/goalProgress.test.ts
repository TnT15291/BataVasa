const mockDb = {
  runAsync: jest.fn(),
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
}

jest.mock('../database/core/db', () => ({
  getDb: jest.fn(() => Promise.resolve(mockDb)),
  nowIso: () => '2026-06-20T00:00:00.000Z',
}))

jest.mock('../services/identity', () => ({
  getCurrentUserId: () => 'user-1',
}))

const t = {
  nav_finance: 'Finance',
  nav_journal: 'Journals',
  nav_reminders: 'Tasks',
  habits: 'Habits',
  tag_all: 'All',
  tag_health: 'Health',
  goal_avg_mood: 'Avg mood',
}
jest.mock('../services/i18n', () => ({
  getTranslations: () => t,
}))

jest.mock('../store/settingsStore', () => ({
  useSettingsStore: { getState: () => ({ language: 'en' }) },
}))

import { calculateGoalProgress, parseGoalBinding } from '../services/goalProgress'
import type { Goal } from '../features/goals/types'

const baseGoal: Goal = {
  id: 'g-1',
  user_id: 'user-1',
  title: 'Reflect more',
  description: null,
  target_type: 'count',
  target_value: 10,
  unit: 'count',
  start_date: '2026-01-01T00:00:00.000Z',
  due_date: '2026-12-31T23:59:59.999Z',
  metric_binding: '',
  status: 'active',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  synced_at: null,
}

beforeEach(() => jest.clearAllMocks())

describe('parseGoalBinding', () => {
  it('accepts a journals entry_count binding with a tag', () => {
    expect(parseGoalBinding(JSON.stringify({ module: 'journals', aggregation: 'entry_count', tag: 'health' })))
      .toEqual({ module: 'journals', aggregation: 'entry_count', tag: 'health' })
  })

  it('accepts a reminders completed_count binding', () => {
    expect(parseGoalBinding(JSON.stringify({ module: 'reminders', aggregation: 'completed_count' })))
      .toEqual({ module: 'reminders', aggregation: 'completed_count' })
  })

  it('rejects a journals binding without a tag', () => {
    expect(parseGoalBinding(JSON.stringify({ module: 'journals', aggregation: 'entry_count' }))).toBeNull()
  })

  it('rejects unknown modules and malformed json', () => {
    expect(parseGoalBinding(JSON.stringify({ module: 'mystery' }))).toBeNull()
    expect(parseGoalBinding('not json')).toBeNull()
  })
})

describe('calculateGoalProgress — journals (entry_count)', () => {
  it('counts entries for the bound tag and reports avg mood', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({ total: 3, avg_mood: 4 })
    const goal: Goal = { ...baseGoal, metric_binding: JSON.stringify({ module: 'journals', aggregation: 'entry_count', tag: 'health' }) }

    const p = await calculateGoalProgress(goal)

    expect(p.current).toBe(3)
    expect(p.percent).toBe(30)
    expect(p.label).toBe('3 / 10')
    expect(p.sourceLabel).toBe('Journals · Health')
    expect(p.note).toBe('Avg mood: 4.0/5')

    const [sql, params] = mockDb.getFirstAsync.mock.calls[0]
    expect(sql).toContain('FROM journal')
    expect(params).toContain('health')
  })

  it('omits the mood note when there are no entries', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({ total: 0, avg_mood: null })
    const goal: Goal = { ...baseGoal, metric_binding: JSON.stringify({ module: 'journals', aggregation: 'entry_count', tag: 'all' }) }

    const p = await calculateGoalProgress(goal)

    expect(p.current).toBe(0)
    expect(p.percent).toBe(0)
    expect(p.note).toBeUndefined()
    expect(p.sourceLabel).toBe('Journals · All')
  })
})

describe('calculateGoalProgress — reminders (completed_count)', () => {
  it('counts completed tasks in range', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({ total: 8 })
    const goal: Goal = { ...baseGoal, target_value: 20, metric_binding: JSON.stringify({ module: 'reminders', aggregation: 'completed_count' }) }

    const p = await calculateGoalProgress(goal)

    expect(p.current).toBe(8)
    expect(p.percent).toBe(40)
    expect(p.label).toBe('8 / 20')
    expect(p.sourceLabel).toBe('Tasks')

    const [sql] = mockDb.getFirstAsync.mock.calls[0]
    expect(sql).toContain('FROM reminder')
    expect(sql).toContain('completed = 1')
  })
})
