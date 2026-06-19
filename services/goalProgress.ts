import { getDb } from '@db/core/db'
import { getCurrentUserId } from '@services/identity'
import { getIntlLocale } from '@services/locale'
import { useSettingsStore } from '@store/settingsStore'
import { getCategory } from '@db/finance/queries'
import { getHabit, listLogCountsByDate } from '@db/habits/queries'
import type { Goal, GoalMetricBinding, GoalProgress } from '@features/goals/types'
import type { Habit } from '@features/habits/types'

export function parseGoalBinding(raw: string): GoalMetricBinding | null {
  try {
    const parsed = JSON.parse(raw) as GoalMetricBinding
    if (parsed.module === 'finance' && parsed.aggregation === 'sum_amount' && parsed.category_id) return parsed
    if (parsed.module === 'habits' && parsed.aggregation === 'completion_rate' && parsed.habit_id) return parsed
    return null
  } catch {
    return null
  }
}

function clampPercent(current: number, target: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((current / target) * 100)))
}

function formatNumber(value: number, unit: string): string {
  const language = useSettingsStore.getState().language
  const locale = getIntlLocale(language)
  if (unit.length === 3) {
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency: unit, maximumFractionDigits: 0 }).format(value)
    } catch {
      return `${Math.round(value).toLocaleString(locale)} ${unit}`
    }
  }
  if (unit === '%') return `${Math.round(value)}%`
  return `${Math.round(value).toLocaleString(locale)} ${unit}`
}

function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isHabitDueOnDate(habit: Pick<Habit, 'cadence' | 'schedule_days'>, date: Date): boolean {
  const day = date.getDay()
  if (habit.cadence === 'weekdays') return day >= 1 && day <= 5
  if (habit.cadence === 'custom') {
    const days = (habit.schedule_days ?? '')
      .split(',')
      .map((v) => Number(v))
      .filter((v) => Number.isInteger(v) && v >= 0 && v <= 6)
    return days.length === 0 ? true : days.includes(day)
  }
  return true
}

export async function calculateGoalProgress(goal: Goal): Promise<GoalProgress> {
  const binding = parseGoalBinding(goal.metric_binding)
  if (!binding) {
    return { current: 0, target: goal.target_value, percent: 0, label: `0 / ${formatNumber(goal.target_value, goal.unit)}`, sourceLabel: 'Unknown source' }
  }

  if (binding.module === 'finance') {
    const db = await getDb()
    const userId = getCurrentUserId()
    const row = await db.getFirstAsync<{ total: number | null }>(
      `SELECT COALESCE(SUM(ABS(amount_cents)), 0) AS total
       FROM finance_transaction
       WHERE deleted_at IS NULL
         AND user_id = ?
         AND category_id = ?
         AND occurred_at >= ?
         AND (? IS NULL OR occurred_at <= ?)`,
      [userId, binding.category_id, goal.start_date, goal.due_date, goal.due_date]
    )
    const cents = row?.total ?? 0
    const current = cents / 100
    const category = await getCategory(binding.category_id, userId)
    return {
      current,
      target: goal.target_value,
      percent: clampPercent(current, goal.target_value),
      label: `${formatNumber(current, goal.unit)} / ${formatNumber(goal.target_value, goal.unit)}`,
      sourceLabel: category?.name ?? 'Finance',
    }
  }

  const userId = getCurrentUserId()
  const habit = await getHabit(binding.habit_id, userId)
  const start = new Date(goal.start_date)
  const end = goal.due_date ? new Date(goal.due_date) : new Date()
  if (!habit || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return { current: 0, target: goal.target_value, percent: 0, label: `0% / ${Math.round(goal.target_value)}%`, sourceLabel: 'Habit' }
  }

  const fromDate = getLocalDateString(start)
  const toDate = getLocalDateString(end)
  const rows = await listLogCountsByDate(habit.id, fromDate, toDate)
  const logMap = new Map(rows.map((row) => [row.date, row.count]))
  let expected = 0
  let completed = 0
  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)
  const last = new Date(end)
  last.setHours(0, 0, 0, 0)
  while (cursor <= last) {
    if (isHabitDueOnDate(habit, cursor)) {
      expected += 1
      const date = getLocalDateString(cursor)
      if ((logMap.get(date) ?? 0) >= habit.target_per_period) completed += 1
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  const current = expected > 0 ? Math.round((completed / expected) * 100) : 0
  return {
    current,
    target: goal.target_value,
    percent: clampPercent(current, goal.target_value),
    label: `${Math.round(current)}% / ${Math.round(goal.target_value)}%`,
    sourceLabel: habit.name,
  }
}
