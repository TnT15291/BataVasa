import { getDb } from '@db/core/db'
import { getCurrentUserId } from '@services/identity'
import { getAICurrency, fmtAI } from './aiLanguage'

// Deterministic full-year rollups across every module, so the assistant can
// compare the user across years ("how have I changed since 2024?") — the core
// "better version" question. Computed straight from SQLite (not the paginated
// in-memory store), so it sees the whole history, not just the last page.
//
// Finance counts only the user's primary currency: summing across currencies
// without FX would be meaningless, and personal use is overwhelmingly single
// currency.

const DEFAULT_YEARS = 5

export type YearRollup = {
  year: number
  income: number
  expense: number
  topCategory: string | null
  habitDone: number
  habitSkipped: number
  habitCount: number
  journalEntries: number
  journalAvgMood: number | null
  journalImportant: number
  tasksTotal: number
  tasksCompleted: number
}

function blankRollup(year: number): YearRollup {
  return {
    year,
    income: 0,
    expense: 0,
    topCategory: null,
    habitDone: 0,
    habitSkipped: 0,
    habitCount: 0,
    journalEntries: 0,
    journalAvgMood: null,
    journalImportant: 0,
    tasksTotal: 0,
    tasksCompleted: 0,
  }
}

function hasData(r: YearRollup): boolean {
  return (
    r.income > 0 ||
    r.expense > 0 ||
    r.habitDone > 0 ||
    r.habitSkipped > 0 ||
    r.journalEntries > 0 ||
    r.tasksTotal > 0
  )
}

/** Pure formatter — fed hand-built rollups in tests, no DB required. */
export function formatLongTermSummary(rollups: YearRollup[], currency: string, now?: Date): string {
  const withData = rollups.filter(hasData).sort((a, b) => b.year - a.year)
  if (withData.length === 0) return ''

  const currentYear = (now ?? new Date()).getFullYear()
  const lines = withData.map((r) => {
    const ytd = r.year === currentYear ? ' (YTD)' : ''
    const net = r.income - r.expense
    const finance = `finance income ${fmtAI(r.income, currency)}, expense ${fmtAI(r.expense, currency)}, net ${fmtAI(net, currency)}${r.topCategory ? `, top spend ${r.topCategory}` : ''}`
    const habits = r.habitDone > 0 || r.habitSkipped > 0
      ? `habits ${r.habitDone} done${r.habitSkipped > 0 ? `/${r.habitSkipped} skip` : ''} across ${r.habitCount} habits`
      : 'habits none'
    const journals = r.journalEntries > 0
      ? `journals ${r.journalEntries} entries${r.journalAvgMood !== null ? `, avg mood ${r.journalAvgMood.toFixed(1)}/5` : ''}${r.journalImportant > 0 ? `, ${r.journalImportant} important` : ''}`
      : 'journals none'
    const tasks = r.tasksTotal > 0
      ? `tasks ${r.tasksCompleted}/${r.tasksTotal} done (${Math.round((r.tasksCompleted / r.tasksTotal) * 100)}%)`
      : 'tasks none'
    return `${r.year}${ytd}: ${finance}; ${habits}; ${journals}; ${tasks}`
  })

  return `LONG-TERM (full-year rollups, deterministic; finance counts the primary currency only). Use these to compare the user across years and show how they are changing:\n${lines.join('\n')}`
}

/** Query SQLite for per-year rollups across all modules and format them. */
export async function buildLongTermSummary(opts?: { now?: Date; years?: number }): Promise<string> {
  try {
    const userId = getCurrentUserId()
    const currency = getAICurrency()
    const years = opts?.years ?? DEFAULT_YEARS
    const db = await getDb()
    const rollups = new Map<number, YearRollup>()
    const get = (yr: number): YearRollup => {
      const existing = rollups.get(yr)
      if (existing) return existing
      const fresh = blankRollup(yr)
      rollups.set(yr, fresh)
      return fresh
    }

    // Finance income/expense per year (primary currency only).
    const finance = await db.getAllAsync<{ yr: string; income: number; expense: number }>(
      `SELECT strftime('%Y', occurred_at) AS yr,
              COALESCE(SUM(CASE WHEN amount_cents > 0 THEN amount_cents ELSE 0 END), 0) AS income,
              COALESCE(SUM(CASE WHEN amount_cents < 0 THEN -amount_cents ELSE 0 END), 0) AS expense
         FROM finance_transaction
        WHERE deleted_at IS NULL AND user_id = ? AND currency = ?
        GROUP BY yr`,
      [userId, currency]
    )
    for (const row of finance) {
      const r = get(Number(row.yr))
      r.income = row.income ?? 0
      r.expense = row.expense ?? 0
    }

    // Top expense category per year.
    const catRows = await db.getAllAsync<{ yr: string; cat: string | null; total: number }>(
      `SELECT strftime('%Y', t.occurred_at) AS yr,
              COALESCE(c.name, 'Other') AS cat,
              SUM(-t.amount_cents) AS total
         FROM finance_transaction t
         LEFT JOIN finance_category c ON c.id = t.category_id
        WHERE t.deleted_at IS NULL AND t.user_id = ? AND t.amount_cents < 0 AND t.currency = ?
        GROUP BY yr, cat`,
      [userId, currency]
    )
    const topByYear = new Map<number, { cat: string; total: number }>()
    for (const row of catRows) {
      const yr = Number(row.yr)
      const best = topByYear.get(yr)
      if (!best || (row.total ?? 0) > best.total) topByYear.set(yr, { cat: row.cat ?? 'Other', total: row.total ?? 0 })
    }
    for (const [yr, top] of topByYear) get(yr).topCategory = top.cat

    // Habits: completions, skips, distinct habits per year.
    const habits = await db.getAllAsync<{ yr: string; done: number; skipped: number; habits: number }>(
      `SELECT strftime('%Y', occurred_at) AS yr,
              SUM(CASE WHEN skipped = 0 THEN 1 ELSE 0 END) AS done,
              SUM(CASE WHEN skipped = 1 THEN 1 ELSE 0 END) AS skipped,
              COUNT(DISTINCT habit_id) AS habits
         FROM habit_log
        WHERE deleted_at IS NULL AND user_id = ?
        GROUP BY yr`,
      [userId]
    )
    for (const row of habits) {
      const r = get(Number(row.yr))
      r.habitDone = row.done ?? 0
      r.habitSkipped = row.skipped ?? 0
      r.habitCount = row.habits ?? 0
    }

    // Journals: count, avg mood, important per year.
    const journals = await db.getAllAsync<{ yr: string; entries: number; avg_mood: number | null; important: number }>(
      `SELECT strftime('%Y', occurred_at) AS yr,
              COUNT(*) AS entries,
              AVG(mood) AS avg_mood,
              SUM(CASE WHEN is_important = 1 THEN 1 ELSE 0 END) AS important
         FROM journal
        WHERE deleted_at IS NULL AND user_id = ?
        GROUP BY yr`,
      [userId]
    )
    for (const row of journals) {
      const r = get(Number(row.yr))
      r.journalEntries = row.entries ?? 0
      r.journalAvgMood = row.avg_mood ?? null
      r.journalImportant = row.important ?? 0
    }

    // Tasks/reminders: scheduled total + completed per year.
    const tasks = await db.getAllAsync<{ yr: string; total: number; completed: number }>(
      `SELECT strftime('%Y', remind_at) AS yr,
              COUNT(*) AS total,
              SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completed
         FROM reminder
        WHERE deleted_at IS NULL AND user_id = ? AND is_inbox = 0
        GROUP BY yr`,
      [userId]
    )
    for (const row of tasks) {
      const r = get(Number(row.yr))
      r.tasksTotal = row.total ?? 0
      r.tasksCompleted = row.completed ?? 0
    }

    const sorted = Array.from(rollups.values())
      .filter((r) => Number.isFinite(r.year))
      .sort((a, b) => b.year - a.year)
      .slice(0, years)

    return formatLongTermSummary(sorted, currency, opts?.now)
  } catch {
    // Long-term context is best-effort; never block a chat reply.
    return ''
  }
}
