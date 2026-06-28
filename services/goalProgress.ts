import { getDb } from '@db/core/db'
import { getCurrentUserId } from '@services/identity'
import { getIntlLocale } from '@services/locale'
import { getTranslations } from '@services/i18n'
import { translateCategoryName } from '@features/finance/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { convertMinorAmount, getRates, toMajorAmount } from '@services/fx'
import { getCategory } from '@db/finance/queries'
import { getHabit, listLogRowsInRange } from '@db/habits/queries'
import type {
  Goal, GoalDirection, GoalMeasure, GoalMeasureProgress, GoalMetricBinding, GoalProgress,
} from '@features/goals/types'
import type { Habit } from '@features/habits/types'

// Validate a raw object into a known binding shape (used by both the string
// parser and the measures-array parser).
function validateBinding(parsed: unknown): GoalMetricBinding | null {
  if (!parsed || typeof parsed !== 'object') return null
  const b = parsed as Record<string, unknown>
  if (b.module === 'finance' && b.aggregation === 'sum_amount' && b.category_id) return b as unknown as GoalMetricBinding
  if (b.module === 'habits' && (b.aggregation === 'completion_rate' || b.aggregation === 'completion_count') && b.habit_id) return b as unknown as GoalMetricBinding
  if (b.module === 'journals' && b.aggregation === 'entry_count' && b.tag) return b as unknown as GoalMetricBinding
  if (b.module === 'reminders' && b.aggregation === 'completed_count') return b as unknown as GoalMetricBinding
  return null
}

export function parseGoalBinding(raw: string): GoalMetricBinding | null {
  try {
    return validateBinding(JSON.parse(raw))
  } catch {
    return null
  }
}

// The list of measures a goal tracks. Prefers the JSON `measures` array; falls
// back to a single measure derived from the legacy columns (pre-multi-measure
// goals, or rows where the array is missing/corrupt).
export function parseGoalMeasures(goal: Goal): GoalMeasure[] {
  if (goal.measures) {
    try {
      const arr = JSON.parse(goal.measures)
      if (Array.isArray(arr)) {
        const valid: GoalMeasure[] = []
        for (const m of arr) {
          const binding = validateBinding(m?.binding)
          if (binding && typeof m?.target_value === 'number' && m.target_value > 0 && typeof m?.unit === 'string' && m.unit) {
            valid.push({
              binding,
              target_type: m.target_type === 'amount' || m.target_type === 'rate' ? m.target_type : 'count',
              target_value: m.target_value,
              unit: m.unit,
              direction: m.direction === 'cap' ? 'cap' : 'reach',
            })
          }
        }
        if (valid.length > 0) return valid
      }
    } catch {
      // fall through to legacy single measure
    }
  }
  const binding = parseGoalBinding(goal.metric_binding)
  if (binding) {
    return [{
      binding,
      target_type: goal.target_type,
      target_value: goal.target_value,
      unit: goal.unit,
      direction: goal.direction,
    }]
  }
  return []
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

// 'reach' goals succeed by hitting the target; 'cap' goals fail by exceeding it.
function progressStatus(current: number, target: number, direction: GoalDirection): GoalProgress['status'] {
  if (direction === 'cap') return current > target ? 'over' : 'on_track'
  return current >= target ? 'reached' : 'on_track'
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

type DateRange = { start_date: string; due_date: string | null }

function financeAmountSign(kind?: string): 'income' | 'outflow' {
  return kind === 'income' ? 'income' : 'outflow'
}

function sameCurrency(a: string, b: string): boolean {
  return a.toUpperCase() === b.toUpperCase()
}

// Progress for a single measure over the goal's date range. This is the old
// per-binding calculation, generalized to take its target/unit/direction from
// the measure instead of the goal.
async function computeMeasureProgress(range: DateRange, measure: GoalMeasure): Promise<GoalProgress> {
  const t = getTranslations()
  const { binding, target_value: target, unit, direction } = measure

  if (binding.module === 'finance') {
    const db = await getDb()
    const userId = getCurrentUserId()
    const category = await getCategory(binding.category_id, userId)
    const sign = financeAmountSign(binding.kind ?? category?.kind)
    const signWhere = sign === 'income' ? 'amount_cents > 0' : 'amount_cents < 0'
    const rows = await db.getAllAsync<{ currency: string; total: number | null }>(
      `SELECT currency, COALESCE(SUM(ABS(amount_cents)), 0) AS total
       FROM finance_transaction
       WHERE deleted_at IS NULL
         AND user_id = ?
         AND category_id = ?
         AND ${signWhere}
         AND occurred_at >= ?
         AND (? IS NULL OR occurred_at <= ?)
       GROUP BY currency`,
      [userId, binding.category_id, range.start_date, range.due_date, range.due_date]
    )
    const needsFx = rows.some((row) => !sameCurrency(row.currency, unit))
    const rates = needsFx ? await getRates(unit) : null
    let total = 0
    let skipped = 0
    for (const row of rows) {
      const amount = row.total ?? 0
      if (sameCurrency(row.currency, unit)) {
        total += amount
      } else if (rates) {
        const converted = convertMinorAmount(amount, row.currency, unit, rates)
        if (converted === null) skipped += 1
        else total += converted
      } else {
        skipped += 1
      }
    }
    const current = toMajorAmount(total, unit)
    return {
      current,
      target,
      percent: clampPercent(current, target),
      label: `${formatNumber(current, unit)} / ${formatNumber(target, unit)}`,
      sourceLabel: category ? translateCategoryName(category, t) : t.nav_finance,
      direction,
      status: progressStatus(current, target, direction),
      note: skipped > 0 ? t.goal_finance_skipped_fx.replace('{{count}}', String(skipped)) : undefined,
    }
  }

  if (binding.module === 'journals') {
    const db = await getDb()
    const userId = getCurrentUserId()
    const end = range.due_date ?? new Date().toISOString()
    const row = await db.getFirstAsync<{ total: number | null; avg_mood: number | null }>(
      `SELECT COUNT(*) AS total, AVG(mood) AS avg_mood
         FROM journal
        WHERE deleted_at IS NULL
          AND user_id = ?
          AND occurred_at >= ?
          AND occurred_at <= ?
          AND (? = 'all' OR (',' || IFNULL(tags, '') || ',') LIKE '%,' || ? || ',%')`,
      [userId, range.start_date, end, binding.tag, binding.tag]
    )
    const current = row?.total ?? 0
    const avgMood = row?.avg_mood
    return {
      current,
      target,
      percent: clampPercent(current, target),
      label: `${formatNumber(current, unit)} / ${formatNumber(target, unit)}`,
      sourceLabel: `${t.nav_journal} · ${translateActivityTag(binding.tag, t)}`,
      direction,
      status: progressStatus(current, target, direction),
      note: current > 0 && typeof avgMood === 'number' ? `${t.goal_avg_mood}: ${avgMood.toFixed(1)}/5` : undefined,
    }
  }

  if (binding.module === 'reminders') {
    const db = await getDb()
    const userId = getCurrentUserId()
    const end = range.due_date ?? new Date().toISOString()
    const row = await db.getFirstAsync<{ total: number | null }>(
      `SELECT COUNT(*) AS total
         FROM reminder
        WHERE deleted_at IS NULL
          AND user_id = ?
          AND completed = 1
          AND is_inbox != 1
          AND remind_at >= ?
          AND remind_at <= ?`,
      [userId, range.start_date, end]
    )
    const current = row?.total ?? 0
    return {
      current,
      target,
      percent: clampPercent(current, target),
      label: `${formatNumber(current, unit)} / ${formatNumber(target, unit)}`,
      sourceLabel: t.nav_reminders,
      direction,
      status: progressStatus(current, target, direction),
    }
  }

  const userId = getCurrentUserId()
  const habit = await getHabit(binding.habit_id, userId)
  // completion_count goals track the raw number of completed days; completion_rate
  // goals track the % of scheduled days hit.
  const isCount = binding.aggregation === 'completion_count'
  const start = new Date(range.start_date)
  const end = range.due_date ? new Date(range.due_date) : new Date()
  if (!habit || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    const label = isCount
      ? `${formatNumber(0, 'count')} / ${formatNumber(target, 'count')}`
      : `0% / ${Math.round(target)}%`
    return { current: 0, target, percent: 0, label, sourceLabel: t.habits, direction, status: progressStatus(0, target, direction) }
  }

  // Fetch raw logs by UTC instant, then bucket onto LOCAL calendar days here —
  // SQLite stores occurred_at in UTC, so deriving the day via substr() would
  // mis-count completions by a day for non-UTC users.
  const from = new Date(`${getLocalDateString(start)}T00:00:00`)
  const to = new Date(`${getLocalDateString(end)}T00:00:00`)
  to.setDate(to.getDate() + 1)
  const rows = await listLogRowsInRange(habit.id, from.toISOString(), to.toISOString())
  const logMap = new Map<string, number>()
  for (const row of rows) {
    if ((row.skipped ?? 0) === 1) continue
    const date = getLocalDateString(new Date(row.occurred_at))
    logMap.set(date, (logMap.get(date) ?? 0) + 1)
  }
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
  const current = isCount ? completed : (expected > 0 ? Math.round((completed / expected) * 100) : 0)
  const label = isCount
    ? `${formatNumber(completed, 'count')} / ${formatNumber(target, 'count')}`
    : `${Math.round(current)}% / ${Math.round(target)}%`
  return {
    current,
    target,
    percent: clampPercent(current, target),
    label,
    sourceLabel: habit.name,
    direction,
    status: progressStatus(current, target, direction),
  }
}

// Each measure's binding + its own progress, in stored order.
export async function calculateGoalMeasureProgress(goal: Goal): Promise<GoalMeasureProgress[]> {
  const measures = parseGoalMeasures(goal)
  const range: DateRange = { start_date: goal.start_date, due_date: goal.due_date }
  const out: GoalMeasureProgress[] = []
  for (const measure of measures) {
    out.push({ binding: measure.binding, progress: await computeMeasureProgress(range, measure) })
  }
  return out
}

// Roll a goal's measures into one headline progress: percent = the lowest (most
// lagging) measure; status = 'over' if any cap is exceeded, 'reached' only when
// every 'reach' measure has hit its target, else 'on_track'. The representative
// label/sourceLabel come from the weakest measure so the list card surfaces what
// is holding the goal back.
export function aggregateGoalProgress(list: GoalMeasureProgress[], goal: Goal): GoalProgress {
  if (list.length === 0) {
    return {
      current: 0, target: goal.target_value, percent: 0,
      label: `0 / ${formatNumber(goal.target_value, goal.unit)}`,
      sourceLabel: '', direction: goal.direction, status: progressStatus(0, goal.target_value, goal.direction),
    }
  }
  if (list.length === 1) return list[0]!.progress

  let weakest = list[0]!
  for (const item of list) if (item.progress.percent < weakest.progress.percent) weakest = item
  const anyOver = list.some((i) => i.progress.status === 'over')
  const reachItems = list.filter((i) => i.progress.direction === 'reach')
  const allReached = reachItems.length > 0 && reachItems.every((i) => i.progress.status === 'reached')
  const status: GoalProgress['status'] = anyOver ? 'over' : allReached ? 'reached' : 'on_track'
  return { ...weakest.progress, percent: weakest.progress.percent, status }
}

export async function calculateGoalProgress(goal: Goal): Promise<GoalProgress> {
  const list = await calculateGoalMeasureProgress(goal)
  return aggregateGoalProgress(list, goal)
}

// Referenced for the activity-tag union; kept exported-adjacent for clarity.
void ACTIVITY_TAG_KEYS
