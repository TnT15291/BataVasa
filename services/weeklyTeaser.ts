import { startOfWeek, endOfWeek, subWeeks } from 'date-fns'
import { getDb } from '@db/core/db'
import { getCurrentUserId } from '@services/identity'
import { getAICurrency, fmtAI } from '@services/ai/aiLanguage'

// A deterministic one-glance teaser baked into the weekly-review notification so
// it shows real numbers ("💸 2.1M (−12%)  ✅ 5  🙂 3.9/5  ⏰ 2") instead of a
// fixed sentence. Computed when the app is open/foregrounded and stamped onto
// the scheduled notification, so no background compute is needed. Icons + numbers
// keep it language-proof (money is locale-formatted via fmtAI); the localized
// title carries the words.

export type WeeklyTeaserMetrics = {
  /** This-week expense in the primary currency. */
  expense: number
  /** % change vs the previous week, or null when there's no prior baseline. */
  expenseDeltaPercent: number | null
  /** Habit completions this week (skips excluded). */
  habitsDone: number
  /** Average journal mood this week (1-5), or null. */
  journalAvgMood: number | null
  /** Open scheduled tasks whose event time is already past. */
  overdueTasks: number
}

/** Pure formatter — fed hand-built metrics in tests, no DB required. */
export function formatWeeklyTeaser(m: WeeklyTeaserMetrics, currency: string): string {
  const parts: string[] = []
  if (m.expense > 0) {
    const delta = m.expenseDeltaPercent !== null
      ? ` (${m.expenseDeltaPercent > 0 ? '+' : ''}${m.expenseDeltaPercent}%)`
      : ''
    parts.push(`💸 ${fmtAI(m.expense, currency)}${delta}`)
  }
  if (m.habitsDone > 0) parts.push(`✅ ${m.habitsDone}`)
  if (m.journalAvgMood !== null) parts.push(`🙂 ${m.journalAvgMood.toFixed(1)}/5`)
  if (m.overdueTasks > 0) parts.push(`⏰ ${m.overdueTasks}`)
  return parts.join('  ·  ')
}

/**
 * Compute the current-week teaser from SQLite. Returns '' when there's nothing
 * worth showing, so callers fall back to the static localized body. Best-effort:
 * never throws — a teaser failure must not block scheduling.
 */
export async function buildWeeklyTeaserBody(now = new Date()): Promise<string> {
  try {
    const userId = getCurrentUserId()
    const currency = getAICurrency()
    const db = await getDb()
    const weekStart = startOfWeek(now, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
    const prevStart = subWeeks(weekStart, 1)
    const prevEnd = subWeeks(weekEnd, 1)

    const inRange = (iso: string, from: Date, to: Date): boolean => {
      const d = new Date(iso)
      return d >= from && d <= to
    }

    // Expense this week vs last week (primary currency only). Fetch the last two
    // weeks and bucket in JS to match the Date-based ranges used elsewhere.
    const txRows = await db.getAllAsync<{ amount_cents: number; occurred_at: string }>(
      `SELECT amount_cents, occurred_at FROM finance_transaction
        WHERE deleted_at IS NULL AND user_id = ? AND currency = ? AND amount_cents < 0 AND occurred_at >= ?`,
      [userId, currency, prevStart.toISOString()]
    )
    let expense = 0
    let prevExpense = 0
    for (const r of txRows) {
      const abs = Math.abs(r.amount_cents)
      if (inRange(r.occurred_at, weekStart, weekEnd)) expense += abs
      else if (inRange(r.occurred_at, prevStart, prevEnd)) prevExpense += abs
    }
    const expenseDeltaPercent = prevExpense > 0 ? Math.round(((expense - prevExpense) / prevExpense) * 100) : null

    // Habit completions this week (skips excluded).
    const logRows = await db.getAllAsync<{ occurred_at: string; skipped: number }>(
      `SELECT occurred_at, skipped FROM habit_log
        WHERE deleted_at IS NULL AND user_id = ? AND occurred_at >= ?`,
      [userId, weekStart.toISOString()]
    )
    let habitsDone = 0
    for (const r of logRows) {
      if (r.skipped === 0 && inRange(r.occurred_at, weekStart, weekEnd)) habitsDone += 1
    }

    // Average journal mood this week.
    const journalRows = await db.getAllAsync<{ occurred_at: string; mood: number | null }>(
      `SELECT occurred_at, mood FROM journal
        WHERE deleted_at IS NULL AND user_id = ? AND occurred_at >= ?`,
      [userId, weekStart.toISOString()]
    )
    const moods: number[] = []
    for (const r of journalRows) {
      if (r.mood != null && inRange(r.occurred_at, weekStart, weekEnd)) moods.push(r.mood)
    }
    const journalAvgMood = moods.length > 0 ? moods.reduce((s, m) => s + m, 0) / moods.length : null

    // Overdue tasks: open, scheduled, event time (remind_at + advance) already past.
    const reminderRows = await db.getAllAsync<{ remind_at: string; advance_minutes: number | null }>(
      `SELECT remind_at, advance_minutes FROM reminder
        WHERE deleted_at IS NULL AND user_id = ? AND is_inbox = 0 AND completed = 0`,
      [userId]
    )
    let overdueTasks = 0
    for (const r of reminderRows) {
      const eventAt = new Date(new Date(r.remind_at).getTime() + (r.advance_minutes ?? 0) * 60000)
      if (eventAt < now) overdueTasks += 1
    }

    return formatWeeklyTeaser(
      { expense, expenseDeltaPercent, habitsDone, journalAvgMood, overdueTasks },
      currency
    )
  } catch {
    return ''
  }
}
