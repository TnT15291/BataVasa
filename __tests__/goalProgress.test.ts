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
  goal_finance_skipped_fx: '{{count}} foreign-currency groups were not counted.',
}
jest.mock('../services/i18n', () => ({
  getTranslations: () => t,
}))

jest.mock('../store/settingsStore', () => ({
  useSettingsStore: { getState: () => ({ language: 'en' }) },
}))

jest.mock('../services/fx', () => {
  const actual = jest.requireActual('../services/fx')
  return { ...actual, getRates: jest.fn() }
})

import { calculateGoalProgress, parseGoalBinding } from '../services/goalProgress'
import { getRates } from '../services/fx'
import type { Goal } from '../features/goals/types'

const mockGetRates = getRates as jest.MockedFunction<typeof getRates>

const baseGoal: Goal = {
  id: 'g-1',
  user_id: 'user-1',
  title: 'Reflect more',
  description: null,
  target_type: 'count',
  target_value: 10,
  unit: 'count',
  direction: 'reach',
  start_date: '2026-01-01T00:00:00.000Z',
  due_date: '2026-12-31T23:59:59.999Z',
  metric_binding: '',
  measures: null,
  status: 'active',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  synced_at: null,
}

const financeCategory = (kind: 'essential' | 'discretionary' | 'income' | 'savings') => ({
  id: 'food',
  user_id: 'user-1',
  name: kind === 'income' ? 'Salary' : 'Food',
  icon: 'tag',
  color: '#22C55E',
  kind,
  parent_id: null,
  sort_order: 0,
  monthly_budget_cents: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  synced_at: null,
})

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

  it('accepts both habit aggregations (completion_rate and completion_count)', () => {
    expect(parseGoalBinding(JSON.stringify({ module: 'habits', aggregation: 'completion_rate', habit_id: 'h1' })))
      .toEqual({ module: 'habits', aggregation: 'completion_rate', habit_id: 'h1' })
    expect(parseGoalBinding(JSON.stringify({ module: 'habits', aggregation: 'completion_count', habit_id: 'h1' })))
      .toEqual({ module: 'habits', aggregation: 'completion_count', habit_id: 'h1' })
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

describe('calculateGoalProgress - finance minor units', () => {
  const financeBinding = JSON.stringify({ module: 'finance', aggregation: 'sum_amount', category_id: 'food' })

  it('keeps zero-decimal VND values as whole units', async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce(financeCategory('savings'))
    mockDb.getAllAsync.mockResolvedValueOnce([{ currency: 'VND', total: 2_000_000 }])
    const goal: Goal = {
      ...baseGoal,
      target_type: 'amount',
      target_value: 2_000_000,
      unit: 'VND',
      metric_binding: financeBinding,
    }

    const p = await calculateGoalProgress(goal)

    expect(p.current).toBe(2_000_000)
    expect(p.percent).toBe(100)
    expect(p.status).toBe('reached')
  })

  it('converts USD cents to display units', async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce(financeCategory('discretionary'))
    mockDb.getAllAsync.mockResolvedValueOnce([{ currency: 'USD', total: 5_000 }])
    const goal: Goal = {
      ...baseGoal,
      target_type: 'amount',
      target_value: 100,
      unit: 'USD',
      metric_binding: financeBinding,
    }

    const p = await calculateGoalProgress(goal)

    expect(p.current).toBe(50)
    expect(p.percent).toBe(50)
    expect(p.status).toBe('on_track')
  })

  it('counts only positive transactions for income categories', async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce(financeCategory('income'))
    mockDb.getAllAsync.mockResolvedValueOnce([{ currency: 'USD', total: 5_000 }])
    const goal: Goal = {
      ...baseGoal,
      target_type: 'amount',
      target_value: 100,
      unit: 'USD',
      metric_binding: financeBinding,
    }

    const p = await calculateGoalProgress(goal)

    expect(p.current).toBe(50)
    expect(mockDb.getAllAsync.mock.calls[0][0]).toContain('amount_cents > 0')
  })

  it('counts only negative set-aside/outflow transactions for savings categories', async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce(financeCategory('savings'))
    mockDb.getAllAsync.mockResolvedValueOnce([{ currency: 'USD', total: 5_000 }])
    const goal: Goal = {
      ...baseGoal,
      target_type: 'amount',
      target_value: 100,
      unit: 'USD',
      metric_binding: financeBinding,
    }

    const p = await calculateGoalProgress(goal)

    expect(p.current).toBe(50)
    expect(mockDb.getAllAsync.mock.calls[0][0]).toContain('amount_cents < 0')
  })

  it('converts foreign-currency finance rows into the goal currency when rates exist', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(financeCategory('savings'))
    mockDb.getAllAsync.mockResolvedValueOnce([
      { currency: 'USD', total: 5_000 },
      { currency: 'VND', total: 250_000 },
    ])
    mockGetRates.mockResolvedValueOnce({ USD: 1, VND: 25_000 })
    const goal: Goal = {
      ...baseGoal,
      target_type: 'amount',
      target_value: 100,
      unit: 'USD',
      metric_binding: financeBinding,
    }

    const p = await calculateGoalProgress(goal)

    expect(p.current).toBe(60)
    expect(p.percent).toBe(60)
    expect(mockGetRates).toHaveBeenCalledWith('USD')
  })

  it('skips foreign-currency finance rows when rates are unavailable', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(financeCategory('savings'))
    mockDb.getAllAsync.mockResolvedValueOnce([
      { currency: 'USD', total: 5_000 },
      { currency: 'VND', total: 250_000 },
    ])
    mockGetRates.mockResolvedValueOnce(null)
    const goal: Goal = {
      ...baseGoal,
      target_type: 'amount',
      target_value: 100,
      unit: 'USD',
      metric_binding: financeBinding,
    }

    const p = await calculateGoalProgress(goal)

    expect(p.current).toBe(50)
    expect(p.percent).toBe(50)
    expect(p.note).toBe('1 foreign-currency groups were not counted.')
  })
})

describe('calculateGoalProgress — direction & status', () => {
  const remindersBinding = JSON.stringify({ module: 'reminders', aggregation: 'completed_count' })

  it('marks a reach goal reached once it hits target', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({ total: 20 })
    const goal: Goal = { ...baseGoal, target_value: 20, metric_binding: remindersBinding }
    const p = await calculateGoalProgress(goal)
    expect(p.direction).toBe('reach')
    expect(p.status).toBe('reached')
  })

  it('keeps a reach goal on_track below target', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({ total: 8 })
    const goal: Goal = { ...baseGoal, target_value: 20, metric_binding: remindersBinding }
    expect((await calculateGoalProgress(goal)).status).toBe('on_track')
  })

  it('flags a cap goal as over once it exceeds the ceiling', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({ total: 25 })
    const goal: Goal = { ...baseGoal, direction: 'cap', target_value: 20, metric_binding: remindersBinding }
    expect((await calculateGoalProgress(goal)).status).toBe('over')
  })

  it('keeps a cap goal on_track while under the ceiling', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({ total: 12 })
    const goal: Goal = { ...baseGoal, direction: 'cap', target_value: 20, metric_binding: remindersBinding }
    expect((await calculateGoalProgress(goal)).status).toBe('on_track')
  })
})

describe('calculateGoalProgress — multiple measures', () => {
  const remindersBinding = { module: 'reminders', aggregation: 'completed_count' }
  const twoMeasures = (a: number, b: number) => JSON.stringify([
    { binding: remindersBinding, target_type: 'count', target_value: a, unit: 'count', direction: 'reach' },
    { binding: remindersBinding, target_type: 'count', target_value: b, unit: 'count', direction: 'reach' },
  ])

  it('aggregates to the lowest measure percent', async () => {
    // measure 1: 6/20 = 30%, measure 2: 8/10 = 80% → overall 30%
    mockDb.getFirstAsync.mockResolvedValueOnce({ total: 6 }).mockResolvedValueOnce({ total: 8 })
    const p = await calculateGoalProgress({ ...baseGoal, measures: twoMeasures(20, 10) })
    expect(p.percent).toBe(30)
    expect(p.status).toBe('on_track')
  })

  it('reports reached only when every reach measure hits its target', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({ total: 20 }).mockResolvedValueOnce({ total: 10 })
    const p = await calculateGoalProgress({ ...baseGoal, measures: twoMeasures(20, 10) })
    expect(p.percent).toBe(100)
    expect(p.status).toBe('reached')
  })

  it('falls back to the legacy single binding when measures is null', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({ total: 8 })
    const goal: Goal = { ...baseGoal, target_value: 20, metric_binding: JSON.stringify(remindersBinding) }
    const p = await calculateGoalProgress(goal)
    expect(p.percent).toBe(40)
    expect(p.sourceLabel).toBe('Tasks')
  })
})
