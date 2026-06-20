import { chatCompletion } from './openai'
import { getAILanguage, fmtAI } from './aiLanguage'
import { subWeeks, startOfWeek, endOfWeek } from 'date-fns'
import type { Transaction, Category } from '@features/finance/types'
import type { Habit, HabitLog } from '@features/habits/types'
import type { Journal } from '@features/journals/types'
import type { Reminder } from '@features/reminders/types'
import type { GoalWithProgress } from '@features/goals/types'

type AmountConverter = (amount: number, currency: string) => number | null

export type WeeklyLifeReviewInput = {
  transactions: Transaction[]
  categories: Category[]
  habits: Array<Habit & { streak?: number }>
  habitLogs: HabitLog[]
  journals: Journal[]
  reminders: Reminder[]
  goals: GoalWithProgress[]
  currency: string
  now?: Date
  amountInCurrency?: AmountConverter
}

export type WeeklyLifeReviewSnapshot = {
  rangeLabel: string
  weekStart: string
  weekEnd: string
  goals: {
    active: number
    onTrack: number
    needsAttention: number
    top: Array<{ title: string; percent: number; label: string; sourceLabel: string }>
  }
  finance: {
    income: number
    expense: number
    net: number
    previousExpense: number
    expenseDeltaPercent: number | null
    topCategories: Array<{ name: string; amount: number }>
    reviewCount: number
  }
  habits: {
    active: number
    completions: number
    skips: number
    bestStreak: number
    topHabits: Array<{ name: string; count: number }>
  }
  journals: {
    entries: number
    important: number
    avgMood: number | null
    tags: Array<{ tag: string; count: number }>
  }
  reminders: {
    due: number
    completed: number
    completionRate: number | null
    overdue: number
    highPriorityOpen: number
  }
}

function isoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function inRange(iso: string, from: Date, to: Date): boolean {
  const d = new Date(iso)
  return d >= from && d <= to
}

function pct(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

function fmtPercent(value: number | null): string {
  if (value === null) return 'n/a'
  return `${value > 0 ? '+' : ''}${value}%`
}

export function buildWeeklyLifeReviewSnapshot(input: WeeklyLifeReviewInput): WeeklyLifeReviewSnapshot {
  const now = input.now ?? new Date()
  const weekStartDate = startOfWeek(now, { weekStartsOn: 1 })
  const weekEndDate = endOfWeek(now, { weekStartsOn: 1 })
  const previousStart = subWeeks(weekStartDate, 1)
  const previousEnd = subWeeks(weekEndDate, 1)
  const convert: AmountConverter = input.amountInCurrency ?? ((amount, currency) => currency === input.currency ? amount : null)
  const catMap = new Map(input.categories.map((c) => [c.id, c]))

  let income = 0
  let expense = 0
  let previousExpense = 0
  const catTotals = new Map<string, number>()
  let reviewCount = 0

  for (const tx of input.transactions) {
    if (tx.deleted_at) continue
    const amount = convert(tx.amount_cents, tx.currency)
    if (amount === null) continue
    if (inRange(tx.occurred_at, weekStartDate, weekEndDate)) {
      if (tx.needs_review === 1) reviewCount += 1
      if (amount > 0) income += amount
      if (amount < 0) {
        const abs = Math.abs(amount)
        expense += abs
        const cat = catMap.get(tx.category_id)
        if (cat?.kind !== 'income') {
          const name = cat?.name ?? 'Other'
          catTotals.set(name, (catTotals.get(name) ?? 0) + abs)
        }
      }
    } else if (inRange(tx.occurred_at, previousStart, previousEnd) && amount < 0) {
      previousExpense += Math.abs(amount)
    }
  }

  const weekLogs = input.habitLogs.filter((log) => !log.deleted_at && inRange(log.occurred_at, weekStartDate, weekEndDate))
  const habitMap = new Map(input.habits.map((h) => [h.id, h]))
  const habitCounts = new Map<string, number>()
  let skips = 0
  for (const log of weekLogs) {
    if (log.skipped === 1) {
      skips += 1
      continue
    }
    habitCounts.set(log.habit_id, (habitCounts.get(log.habit_id) ?? 0) + 1)
  }

  const weekJournals = input.journals.filter((j) => !j.deleted_at && inRange(j.occurred_at, weekStartDate, weekEndDate))
  const moods = weekJournals.map((j) => j.mood).filter((m): m is number => m !== null)
  const tagCounts = new Map<string, number>()
  for (const journal of weekJournals) {
    for (const raw of (journal.tags ?? '').split(',')) {
      const tag = raw.trim()
      if (tag) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }

  const weekReminders = input.reminders.filter((r) => {
    if (r.deleted_at || r.is_inbox === 1) return false
    const eventAt = new Date(new Date(r.remind_at).getTime() + (r.advance_minutes ?? 0) * 60000).toISOString()
    return inRange(eventAt, weekStartDate, weekEndDate)
  })
  const reminderDone = weekReminders.filter((r) => r.completed === 1).length

  const activeGoals = input.goals.filter((g) => g.status === 'active' && !g.deleted_at)
  const goalTop = activeGoals
    .map((g) => ({ title: g.title, percent: g.progress.percent, label: g.progress.label, sourceLabel: g.progress.sourceLabel }))
    .sort((a, b) => a.percent - b.percent)
    .slice(0, 4)

  return {
    rangeLabel: `${isoDate(weekStartDate)} - ${isoDate(weekEndDate)}`,
    weekStart: isoDate(weekStartDate),
    weekEnd: isoDate(weekEndDate),
    goals: {
      active: activeGoals.length,
      onTrack: activeGoals.filter((g) => g.progress.percent >= 70).length,
      needsAttention: activeGoals.filter((g) => g.progress.percent < 40).length,
      top: goalTop,
    },
    finance: {
      income,
      expense,
      net: income - expense,
      previousExpense,
      expenseDeltaPercent: pct(expense, previousExpense),
      topCategories: Array.from(catTotals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, amount]) => ({ name, amount })),
      reviewCount,
    },
    habits: {
      active: input.habits.filter((h) => !h.deleted_at).length,
      completions: Array.from(habitCounts.values()).reduce((s, n) => s + n, 0),
      skips,
      bestStreak: input.habits.length > 0 ? Math.max(...input.habits.map((h) => h.streak ?? 0)) : 0,
      topHabits: Array.from(habitCounts.entries())
        .map(([id, count]) => ({ name: habitMap.get(id)?.name ?? 'Habit', count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 4),
    },
    journals: {
      entries: weekJournals.length,
      important: weekJournals.filter((j) => j.is_important === 1).length,
      avgMood: moods.length > 0 ? moods.reduce((s, m) => s + m, 0) / moods.length : null,
      tags: Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tag, count]) => ({ tag, count })),
    },
    reminders: {
      due: weekReminders.length,
      completed: reminderDone,
      completionRate: weekReminders.length > 0 ? Math.round((reminderDone / weekReminders.length) * 100) : null,
      overdue: weekReminders.filter((r) => r.completed !== 1 && new Date(r.remind_at) < now).length,
      highPriorityOpen: weekReminders.filter((r) => r.priority === 'high' && r.completed !== 1).length,
    },
  }
}

export function weeklyLifeReviewSummary(snapshot: WeeklyLifeReviewSnapshot, currency: string): string {
  const goals = snapshot.goals.top.length > 0
    ? snapshot.goals.top.map((g) => `  ${g.title}: ${g.percent}% (${g.label}) via ${g.sourceLabel || 'source'}`).join('\n')
    : '  No active goals'
  const cats = snapshot.finance.topCategories.length > 0
    ? snapshot.finance.topCategories.map((c) => `  ${c.name}: ${fmtAI(c.amount, currency)}`).join('\n')
    : '  No spending categories'
  const habits = snapshot.habits.topHabits.length > 0
    ? snapshot.habits.topHabits.map((h) => `  ${h.name}: ${h.count} completions`).join('\n')
    : '  No habit completions'
  const tags = snapshot.journals.tags.length > 0
    ? snapshot.journals.tags.map((t) => `  ${t.tag}: ${t.count}`).join('\n')
    : '  No journal tags'

  return `WEEK: ${snapshot.rangeLabel}
GOALS: ${snapshot.goals.active} active, ${snapshot.goals.onTrack} on track, ${snapshot.goals.needsAttention} need attention
${goals}

FINANCE: income ${fmtAI(snapshot.finance.income, currency)}, expense ${fmtAI(snapshot.finance.expense, currency)}, net ${fmtAI(snapshot.finance.net, currency)}, expense vs previous week ${fmtPercent(snapshot.finance.expenseDeltaPercent)}, review items ${snapshot.finance.reviewCount}
Top categories:
${cats}

HABITS: ${snapshot.habits.completions} completions, ${snapshot.habits.skips} skips, best streak ${snapshot.habits.bestStreak}d
${habits}

JOURNALS: ${snapshot.journals.entries} entries, avg mood ${snapshot.journals.avgMood === null ? 'n/a' : snapshot.journals.avgMood.toFixed(1)}, important ${snapshot.journals.important}
Tags:
${tags}

TASKS: ${snapshot.reminders.due} due, ${snapshot.reminders.completed} completed, completion rate ${snapshot.reminders.completionRate === null ? 'n/a' : `${snapshot.reminders.completionRate}%`}, overdue ${snapshot.reminders.overdue}, high-priority open ${snapshot.reminders.highPriorityOpen}`
}

export async function generateWeeklyLifeReview(snapshot: WeeklyLifeReviewSnapshot, currency: string): Promise<string> {
  const language = getAILanguage()
  const summary = weeklyLifeReviewSummary(snapshot, currency)

  return chatCompletion([
    {
      role: 'system',
      content: `You are BataVasa's weekly life review assistant. Reply in ${language} only. Be calm, practical, specific, and non-judgmental. Use concise markdown sections with ## headings.`,
    },
    {
      role: 'user',
      content: `Write a weekly life review from these precomputed metrics. Do not recalculate. Reference exact numbers and avoid generic advice.

${summary}

Use 5 sections:
1. Week at a glance
2. Goals and direction
3. Money, habits, mood, and tasks
4. What deserves attention next week
5. 2-3 concrete actions for next week`,
    },
  ])
}
