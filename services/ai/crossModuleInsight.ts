import { chatCompletion } from './openai'
import { getAILanguage, getAICurrency, fmtAI } from './aiLanguage'
import { subDays } from 'date-fns'
import type { Transaction, Category } from '@features/finance/types'
import type { Habit, HabitLog } from '@features/habits/types'
import type { Journal } from '@features/journals/types'
import type { Reminder } from '@features/reminders/types'

type HabitWithStats = Habit & { todayCount: number; streak: number }

type CrossModuleInput = {
  transactions: Transaction[]
  categories: Category[]
  habits: HabitWithStats[]
  journals: Journal[]
  // Optional richer data: enables habit↔mood↔spending↔task correlations.
  habitLogs?: HabitLog[]
  reminders?: Reminder[]
}

type DayStat = {
  expense: number
  income: number
  moodSum: number
  moodCount: number
  journalCount: number
  remindersDue: number
  remindersDone: number
}

function calculatePromptSafeToSpend(input: {
  transactions: Transaction[]
  categories: Category[]
  currency: string
}): { safeToSpend: number } {
  const now = new Date()
  const month = now.getMonth()
  const year = now.getFullYear()
  let income = 0
  let expense = 0
  for (const tx of input.transactions) {
    if (tx.currency !== input.currency) continue
    const d = new Date(tx.occurred_at)
    if (d.getMonth() !== month || d.getFullYear() !== year) continue
    if (tx.amount_cents > 0) {
      income += tx.amount_cents
      continue
    }
    expense += Math.abs(tx.amount_cents)
  }
  return { safeToSpend: Math.max(0, income - expense) }
}

function dayMood(d: DayStat): number | null {
  return d.moodCount > 0 ? d.moodSum / d.moodCount : null
}

function buildDayStats(
  txs: Transaction[],
  journals: Journal[],
  reminders: Reminder[],
  cutoff: string,
): Map<string, DayStat> {
  const days = new Map<string, DayStat>()
  const blank = (): DayStat => ({ expense: 0, income: 0, moodSum: 0, moodCount: 0, journalCount: 0, remindersDue: 0, remindersDone: 0 })

  for (const tx of txs) {
    if (tx.occurred_at < cutoff) continue
    const date = tx.occurred_at.split('T')[0]!
    const d = days.get(date) ?? blank()
    if (tx.amount_cents < 0) d.expense += Math.abs(tx.amount_cents)
    else if (tx.amount_cents > 0) d.income += tx.amount_cents
    days.set(date, d)
  }

  for (const j of journals) {
    if (j.occurred_at < cutoff) continue
    const date = j.occurred_at.split('T')[0]!
    const d = days.get(date) ?? blank()
    if (j.mood != null) {
      d.moodSum += j.mood
      d.moodCount++
    }
    d.journalCount++
    days.set(date, d)
  }

  const nowIso = new Date().toISOString()
  for (const r of reminders) {
    if (r.deleted_at || r.is_inbox === 1) continue
    // Event time = notification time + advance window.
    const eventAt = new Date(new Date(r.remind_at).getTime() + (r.advance_minutes ?? 0) * 60000).toISOString()
    if (eventAt < cutoff || eventAt > nowIso) continue
    const date = eventAt.split('T')[0]!
    const d = days.get(date) ?? blank()
    d.remindersDue++
    if (r.completed === 1) d.remindersDone++
    days.set(date, d)
  }

  return days
}

function correlationBlock(days: Map<string, DayStat>, currency: string): string | null {
  const daysWithExpense = Array.from(days.values()).filter((d) => d.expense > 0)
  if (daysWithExpense.length < 5) return null

  const avgExpense = daysWithExpense.reduce((s, d) => s + d.expense, 0) / daysWithExpense.length
  const highSpend = daysWithExpense.filter((d) => d.expense > avgExpense * 1.2)
  const lowSpend = daysWithExpense.filter((d) => d.expense <= avgExpense)

  const lines: string[] = [
    `Avg daily spend (on spending days): ${fmtAI(Math.round(avgExpense), currency)}`,
  ]

  // Mood on high-spend vs low-spend days
  const highMoods = highSpend.map(dayMood).filter((m): m is number => m != null)
  const lowMoods = lowSpend.map(dayMood).filter((m): m is number => m != null)
  if (highMoods.length >= 2 && lowMoods.length >= 2) {
    const avgHighMood = (highMoods.reduce((s, m) => s + m, 0) / highMoods.length).toFixed(1)
    const avgLowMood = (lowMoods.reduce((s, m) => s + m, 0) / lowMoods.length).toFixed(1)
    lines.push(`Mood on high-spend days (>${fmtAI(Math.round(avgExpense * 1.2), currency)}): ${avgHighMood}/5  vs  low-spend days: ${avgLowMood}/5`)
  }

  // Journaling frequency on spending vs non-spending days
  const spendingDays = daysWithExpense.length
  const journaledOnSpendDays = daysWithExpense.filter((d) => d.journalCount > 0).length
  if (journaledOnSpendDays > 0) {
    lines.push(`Journaled on ${journaledOnSpendDays}/${spendingDays} spending days (${Math.round((journaledOnSpendDays / spendingDays) * 100)}%)`)
  }

  // Weekly spend trend (last 4 weeks)
  const weekSpend = new Map<string, number>()
  for (const [date, d] of days.entries()) {
    const dt = new Date(date)
    dt.setDate(dt.getDate() - dt.getDay())
    const wk = dt.toISOString().split('T')[0]!
    weekSpend.set(wk, (weekSpend.get(wk) ?? 0) + d.expense)
  }
  const weekTrend = Array.from(weekSpend.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-4)
    .map(([w, t]) => `${w}: ${fmtAI(t, currency)}`)
  if (weekTrend.length > 1) lines.push(`Weekly spend trend:\n  ${weekTrend.join('\n  ')}`)

  return lines.join('\n')
}

const avg = (nums: number[]) => nums.reduce((s, n) => s + n, 0) / nums.length

/**
 * Per-habit before/after comparison: for each habit with enough logs, split
 * the last 30 days into "kept" vs "missed" days and compare mood, spending,
 * reminder completion, and how many OTHER habits were done. This is the
 * rule-based ground truth the model explains — never ask AI to compute it.
 */
function habitImpactBlock(
  habits: HabitWithStats[],
  habitLogs: HabitLog[],
  days: Map<string, DayStat>,
  cutoff: string,
  currency: string,
): string | null {
  if (habits.length === 0 || habitLogs.length === 0) return null

  const windowLogs = habitLogs.filter((l) => !l.deleted_at && l.occurred_at >= cutoff && l.skipped !== 1)
  if (windowLogs.length === 0) return null

  const doneDatesByHabit = new Map<string, Set<string>>()
  for (const log of windowLogs) {
    const date = log.occurred_at.split('T')[0]!
    const set = doneDatesByHabit.get(log.habit_id) ?? new Set<string>()
    set.add(date)
    doneDatesByHabit.set(log.habit_id, set)
  }

  // All calendar dates in the window (cutoff..today).
  const allDates: string[] = []
  for (let d = new Date(cutoff); d <= new Date(); d.setDate(d.getDate() + 1)) {
    allDates.push(d.toISOString().split('T')[0]!)
  }

  const sections: string[] = []
  for (const habit of habits) {
    const doneDates = doneDatesByHabit.get(habit.id)
    if (!doneDates || doneDates.size < 5) continue // too sparse to compare
    const missedDates = allDates.filter((date) => !doneDates.has(date))
    if (missedDates.length < 3) continue // kept almost every day — nothing to contrast

    const lines: string[] = [`${habit.icon} "${habit.name}" — kept ${doneDates.size}/${allDates.length} days, current streak ${habit.streak}d:`]

    const statsFor = (dates: string[]) => dates.map((date) => days.get(date)).filter((d): d is DayStat => !!d)
    const kept = statsFor([...doneDates])
    const missed = statsFor(missedDates)

    const keptMoods = kept.map(dayMood).filter((m): m is number => m != null)
    const missedMoods = missed.map(dayMood).filter((m): m is number => m != null)
    if (keptMoods.length >= 3 && missedMoods.length >= 3) {
      lines.push(`  mood: ${avg(keptMoods).toFixed(1)}/5 on kept days (${keptMoods.length} journaled) vs ${avg(missedMoods).toFixed(1)}/5 on missed days (${missedMoods.length})`)
    }

    const keptSpend = kept.map((d) => d.expense)
    const missedSpend = missed.map((d) => d.expense)
    if (keptSpend.length >= 3 && missedSpend.length >= 3) {
      const keptAvg = Math.round(avg(keptSpend))
      const missedAvg = Math.round(avg(missedSpend))
      const delta = missedAvg > 0 ? Math.round(((keptAvg - missedAvg) / missedAvg) * 100) : null
      lines.push(`  avg daily spend: ${fmtAI(keptAvg, currency)} on kept days vs ${fmtAI(missedAvg, currency)} on missed days${delta !== null && Math.abs(delta) >= 15 ? ` (${delta > 0 ? '+' : ''}${delta}% — notable)` : ''}`)
    }

    const completionRate = (stats: DayStat[]) => {
      const due = stats.reduce((s, d) => s + d.remindersDue, 0)
      const done = stats.reduce((s, d) => s + d.remindersDone, 0)
      return due >= 3 ? Math.round((done / due) * 100) : null
    }
    const keptTasks = completionRate(kept)
    const missedTasks = completionRate(missed)
    if (keptTasks !== null && missedTasks !== null) {
      lines.push(`  reminders/tasks completed: ${keptTasks}% on kept days vs ${missedTasks}% on missed days`)
    }

    // Do other habits get skipped when this one is missed?
    const otherDone = (dates: string[]) =>
      dates.map((date) => {
        let count = 0
        for (const [otherId, otherDates] of doneDatesByHabit.entries()) {
          if (otherId !== habit.id && otherDates.has(date)) count++
        }
        return count
      })
    if (doneDatesByHabit.size > 1) {
      const keptOther = otherDone([...doneDates])
      const missedOther = otherDone(missedDates)
      lines.push(`  other habits done: avg ${avg(keptOther).toFixed(1)}/day on kept days vs ${avg(missedOther).toFixed(1)}/day on missed days`)
    }

    if (lines.length > 1) sections.push(lines.join('\n'))
  }

  return sections.length > 0 ? sections.join('\n') : null
}

/** When does the money go: time-of-day and weekday distribution of expenses. */
function spendTimingBlock(txs: Transaction[], currency: string): string | null {
  const expenses = txs.filter((t) => t.amount_cents < 0)
  if (expenses.length < 8) return null

  const slots = [
    { label: 'morning 05-11h', from: 5, to: 11, total: 0, count: 0 },
    { label: 'midday 11-17h', from: 11, to: 17, total: 0, count: 0 },
    { label: 'evening 17-22h', from: 17, to: 22, total: 0, count: 0 },
    { label: 'night 22-05h', from: 22, to: 29, total: 0, count: 0 },
  ]
  const weekdays = new Map<number, { total: number; count: number }>()
  for (const tx of expenses) {
    const d = new Date(tx.occurred_at)
    const hour = d.getHours()
    const slot = slots.find((s) => (hour >= s.from && hour < s.to) || (s.from === 22 && (hour >= 22 || hour < 5)))
    if (slot) {
      slot.total += Math.abs(tx.amount_cents)
      slot.count++
    }
    const wd = d.getDay()
    const entry = weekdays.get(wd) ?? { total: 0, count: 0 }
    entry.total += Math.abs(tx.amount_cents)
    entry.count++
    weekdays.set(wd, entry)
  }

  const lines: string[] = []
  const slotLines = slots
    .filter((s) => s.count > 0)
    .map((s) => `${s.label}: ${fmtAI(s.total, currency)} (${s.count} tx)`)
  if (slotLines.length >= 2) lines.push(`By time of day:\n  ${slotLines.join('\n  ')}`)

  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const wdEntries = Array.from(weekdays.entries()).sort((a, b) => b[1].total - a[1].total)
  if (wdEntries.length >= 3) {
    const top = wdEntries[0]!
    const bottom = wdEntries[wdEntries.length - 1]!
    lines.push(`Highest-spend weekday: ${WD[top[0]]} (${fmtAI(top[1].total, currency)}) · lowest: ${WD[bottom[0]]} (${fmtAI(bottom[1].total, currency)})`)
  }

  return lines.length > 0 ? lines.join('\n') : null
}

/** Spending on days tagged with each journal activity (work, social, stress…). */
function activitySpendBlock(
  journals: Journal[],
  days: Map<string, DayStat>,
  cutoff: string,
  currency: string,
): string | null {
  const tagDates = new Map<string, Set<string>>()
  for (const j of journals) {
    if (j.occurred_at < cutoff || !j.tags) continue
    const date = j.occurred_at.split('T')[0]!
    for (const raw of j.tags.split(',')) {
      const tag = raw.trim()
      if (!tag) continue
      const set = tagDates.get(tag) ?? new Set<string>()
      set.add(date)
      tagDates.set(tag, set)
    }
  }
  if (tagDates.size === 0) return null

  const lines: string[] = []
  for (const [tag, dates] of tagDates.entries()) {
    if (dates.size < 3) continue
    const spends = [...dates].map((date) => days.get(date)?.expense ?? 0)
    lines.push(`${tag}: avg ${fmtAI(Math.round(avg(spends)), currency)}/day across ${dates.size} tagged days`)
  }
  return lines.length > 0 ? `Avg spending on days tagged with each activity:\n  ${lines.join('\n  ')}` : null
}

function buildSummary(input: CrossModuleInput, currency: string): string {
  const { transactions, categories, habits, journals } = input
  const habitLogs = input.habitLogs ?? []
  const reminders = input.reminders ?? []
  const cutoff = subDays(new Date(), 30).toISOString()
  const recentTxs = transactions.filter((t) => t.occurred_at >= cutoff)
  const recentJournals = journals.filter((j) => j.occurred_at >= cutoff)

  const sections: string[] = []

  // Finance summary
  if (recentTxs.length > 0) {
    const catMap = new Map(categories.map((c) => [c.id, c]))
    let income = 0, expense = 0
    const catTotals = new Map<string, number>()
    for (const tx of recentTxs) {
      const name = catMap.get(tx.category_id)?.name ?? 'Other'
      const abs = Math.abs(tx.amount_cents)
      if (tx.amount_cents > 0) income += abs
      else {
        expense += abs
        catTotals.set(name, (catTotals.get(name) ?? 0) + abs)
      }
    }
    const topCats = Array.from(catTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, amt]) => `  ${name}: ${fmtAI(amt, currency)}`)
    const safe = calculatePromptSafeToSpend({ transactions, categories, currency })
    sections.push(`FINANCE (last 30 days):\n  Income: ${fmtAI(income, currency)} | Expense: ${fmtAI(expense, currency)} | Net cash: ${fmtAI(income - expense, currency)} | Safe to spend: ${fmtAI(safe.safeToSpend, currency)}\n  Top spending categories:\n${topCats.join('\n')}`)
  }

  // Habits summary
  if (habits.length > 0) {
    const habitLines = habits.map((h) => {
      const health = h.streak >= 7 ? '🟢 strong' : h.streak >= 3 ? '🟡 building' : '🔴 needs attention'
      return `  ${h.icon} ${h.name} (${h.cadence}): streak ${h.streak}d — ${health}`
    })
    const avgStreak = Math.round(habits.reduce((s, h) => s + h.streak, 0) / habits.length)
    sections.push(`HABITS (${habits.length} total, avg streak ${avgStreak} days):\n${habitLines.join('\n')}`)
  }

  // Journal summary
  if (recentJournals.length > 0) {
    const withMood = recentJournals.filter((j) => j.mood != null)
    const avgMood = withMood.length > 0
      ? (withMood.reduce((s, j) => s + (j.mood ?? 0), 0) / withMood.length).toFixed(1)
      : 'N/A'
    const importantCount = recentJournals.filter((j) => j.is_important === 1).length
    const snippets = recentJournals.slice(0, 4).map((j) => {
      const moodTag = j.mood != null ? `[mood:${j.mood}] ` : ''
      return `  ${j.occurred_at.split('T')[0]}: ${moodTag}${j.content.slice(0, 120).replace(/\n+/g, ' ')}`
    })
    sections.push(`JOURNALS (${recentJournals.length} entries, avg mood: ${avgMood}/5, important: ${importantCount}):\n${snippets.join('\n')}`)
  }

  // Reminders summary
  const recentReminders = reminders.filter((r) => !r.deleted_at && r.is_inbox !== 1 && r.remind_at >= cutoff && r.remind_at <= new Date().toISOString())
  if (recentReminders.length >= 3) {
    const done = recentReminders.filter((r) => r.completed === 1).length
    sections.push(`REMINDERS/TASKS (last 30 days): ${recentReminders.length} due, ${done} completed (${Math.round((done / recentReminders.length) * 100)}%)`)
  }

  const dayStats = buildDayStats(recentTxs, recentJournals, reminders, cutoff)

  // Cross-module correlation block
  const corr = correlationBlock(dayStats, currency)
  if (corr) sections.push(`CROSS-MODULE PATTERNS:\n${corr}`)

  // Habit kept-vs-missed impact on mood / spending / tasks / other habits
  const habitImpact = habitImpactBlock(habits, habitLogs, dayStats, cutoff, currency)
  if (habitImpact) sections.push(`HABIT IMPACT (kept vs missed days, last 30 days):\n${habitImpact}`)

  // When and around which activities the money goes
  const timing = spendTimingBlock(recentTxs, currency)
  if (timing) sections.push(`SPENDING TIMING:\n${timing}`)

  const activity = activitySpendBlock(recentJournals, dayStats, cutoff, currency)
  if (activity) sections.push(`SPENDING BY JOURNAL ACTIVITY:\n${activity}`)

  return sections.join('\n\n')
}

export async function generateCrossModuleInsights(input: CrossModuleInput): Promise<string> {
  const hasData = input.transactions.length > 0 || input.habits.length > 0 || input.journals.length > 0
  if (!hasData) throw new Error('NO_DATA')

  const language = getAILanguage()
  const currency = getAICurrency()
  const summary = buildSummary(input, currency)

  return chatCompletion([
    {
      role: 'system',
      content: `You are a holistic personal life assistant. CRITICAL: Reply in ${language} ONLY. ALL headings and content MUST be in ${language}. Be concise, specific, empathetic, and non-judgmental. Use short markdown sections (## heading).`,
    },
    {
      role: 'user',
      content: `Analyze my personal data from the last 30 days. Be specific — reference actual numbers, dates, and patterns from the data. Do not give generic advice. All statistics are pre-computed above; explain them, do not recalculate.

${summary}

Write 5-6 ## sections in ${language}. Cover:
1. Tổng kết tháng (key highlights across all modules)
2. Tác động của thói quen (from HABIT IMPACT: for each habit compared, explain what happens when it is kept vs missed — mood, whether spending rises or falls unusually, whether tasks get forgotten or other habits get skipped. Flag any spending change marked "notable")
3. Khi nào và lúc làm gì bạn tiêu nhiều/ít nhất (from SPENDING TIMING and SPENDING BY JOURNAL ACTIVITY: which time of day, weekday, and journaled activities coincide with the highest and lowest spending)
4. Pattern đáng chú ý khác (other cross-module connections between finance, habits, journals, and tasks — e.g. spending↔mood from CROSS-MODULE PATTERNS)
5. Điểm mạnh & điểm cần cải thiện (reference specific data points)
6. 2-3 hành động ưu tiên (concrete recommendations that would improve finances AND mood, grounded in the correlations above)

Skip a section gracefully if its data block is missing. Correlation is not causation — phrase findings as observations ("on days you kept X, spending was lower"), not verdicts.`,
    },
  ])
}
