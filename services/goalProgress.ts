import { getDb } from '@db/core/db'
import { getCurrentUserId } from '@services/identity'
import { getIntlLocale } from '@services/locale'
import { getTranslations } from '@services/i18n'
import { translateCategoryName } from '@features/finance/i18n'
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
    if (parsed.module === 'journals' && parsed.aggregation === 'entry_count' && parsed.tag) return parsed
    if (parsed.module === 'reminders' && parsed.aggregation === 'completed_count') return parsed
    return null
  } catch {
    return null
  }
}

const ACTIVITY_TAG_KEYS = [
  'work', 'family', 'health', 'money', 'sleep',
  'exercise', 'stress', 'food', 'travel', 'social',
] as const

function translateActivityTag(tag: string, t: ReturnType<typeof getTranslations>): string {
  if (tag === 'all') return t.tag_all
  const key = `tag_${tag}` as keyof typeof t
  const label = t[key]
  return typeof label === 'string' ? label : tag
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
  if (unit === 'count') return Math.round(value).toLocaleString(locale)
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
  const t = getTranslations()
  const binding = parseGoalBinding(goal.metric_binding)
  if (!binding) {
    return { current: 0, target: goal.target_value, percent: 0, label: `0 / ${formatNumber(goal.target_value, goal.unit)}`, sourceLabel: '' }
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
      sourceLabel: category ? translateCategoryName(category, t) : t.nav_finance,
    }
  }

  if (binding.module === 'journals') {
    const db = await getDb()
    const userId = getCurrentUserId()
    const end = goal.due_date ?? new Date().toISOString()
    const row = await db.getFirstAsync<{ total: number | null; avg_mood: number | null }>(
      `SELECT COUNT(*) AS total, AVG(mood) AS avg_mood
         FROM journal
        WHERE deleted_at IS NULL
          AND user_id = ?
          AND occurred_at >= ?
          AND occurred_at <= ?
          AND (? = 'all' OR (',' || IFNULL(tags, '') || ',') LIKE '%,' || ? || ',%')`,
      [userId, goal.start_date, end, binding.tag, binding.tag]
    )
    const current = row?.total ?? 0
    const avgMood = row?.avg_mood
    return {
      current,
      target: goal.target_value,
      percent: clampPercent(current, goal.target_value),
      label: `${formatNumber(current, goal.unit)} / ${formatNumber(goal.target_value, goal.unit)}`,
      sourceLabel: `${t.nav_journal} · ${translateActivityTag(binding.tag, t)}`,
      note: current > 0 && typeof avgMood === 'number' ? `${t.goal_avg_mood}: ${avgMood.toFixed(1)}/5` : undefined,
    }
  }

  if (binding.module === 'reminders') {
    const db = await getDb()
    const userId = getCurrentUserId()
    const end = goal.due_date ?? new Date().toISOString()
    const row = await db.getFirstAsync<{ total: number | null }>(
      `SELECT COUNT(*) AS total
         FROM reminder
        WHERE deleted_at IS NULL
          AND user_id = ?
          AND completed = 1
          AND is_inbox != 1
          AND remind_at >= ?
          AND remind_at <= ?`,
      [userId, goal.start_date, end]
    )
    const current = row?.total ?? 0
    return {
      current,
      target: goal.target_value,
      percent: clampPercent(current, goal.target_value),
      label: `${formatNumber(current, goal.unit)} / ${formatNumber(goal.target_value, goal.unit)}`,
      sourceLabel: t.nav_reminders,
    }
  }

  const userId = getCurrentUserId()
  const habit = await getHabit(binding.habit_id, userId)
  const start = new Date(goal.start_date)
  const end = goal.due_date ? new Date(goal.due_date) : new Date()
  if (!habit || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return { current: 0, target: goal.target_value, percent: 0, label: `0% / ${Math.round(goal.target_value)}%`, sourceLabel: t.habits }
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
