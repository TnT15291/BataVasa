import { format, isSameDay, subDays } from 'date-fns'
import { getAICurrency, getAILanguage, fmtAI } from './aiLanguage'
import type { Category, Transaction } from '@features/finance/types'
import type { Habit } from '@features/habits/types'
import type { Journal } from '@features/journals/types'
import type { Reminder } from '@features/reminders/types'
import type { GoalWithProgress } from '@features/goals/types'

type HabitForAssistant = Habit & {
  streak?: number
  todayCount?: number
  dueToday?: boolean
}

type BuildAssistantContextInput = {
  transactions: Transaction[]
  categories: Category[]
  habits: HabitForAssistant[]
  journals: Journal[]
  reminders: Reminder[]
  goals?: GoalWithProgress[]
  now?: Date
}

function clean(text: string | null | undefined): string {
  return String(text ?? '').replace(/\s+/g, ' ').trim()
}

function inLastDays(iso: string, now: Date, days: number): boolean {
  const d = new Date(iso)
  return d >= subDays(now, days) && d <= now
}

function topEntries(map: Map<string, number>, limit: number): Array<[string, number]> {
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, limit)
}

function formatDateTime(iso: string): string {
  return format(new Date(iso), 'yyyy-MM-dd HH:mm')
}

function eventTime(reminder: Reminder): Date {
  return new Date(new Date(reminder.remind_at).getTime() + (reminder.advance_minutes ?? 0) * 60000)
}

export function buildAssistantContext(input: BuildAssistantContextInput): string {
  const now = input.now ?? new Date()
  const currency = getAICurrency()
  const catMap = new Map(input.categories.map((c) => [c.id, c]))
  const activeTxs = input.transactions.filter((tx) => !tx.deleted_at)
  const recentTxs = activeTxs.filter((tx) => inLastDays(tx.occurred_at, now, 30))

  let income30 = 0
  let expense30 = 0
  let expense7 = 0
  const catTotals = new Map<string, number>()
  const reviewTxs: string[] = []
  for (const tx of recentTxs) {
    const amount = tx.amount_cents
    const cat = catMap.get(tx.category_id)
    if (amount > 0) income30 += amount
    if (amount < 0) {
      const abs = Math.abs(amount)
      expense30 += abs
      if (inLastDays(tx.occurred_at, now, 7)) expense7 += abs
      if (cat?.kind !== 'income') catTotals.set(cat?.name ?? 'Other', (catTotals.get(cat?.name ?? 'Other') ?? 0) + abs)
    }
    if (tx.needs_review === 1) {
      const title = clean(tx.merchant || tx.note || cat?.name || 'Transaction')
      reviewTxs.push(`${title} (${fmtAI(Math.abs(amount), tx.currency || currency)})`)
    }
  }
  const topFinance = topEntries(catTotals, 6)
    .map(([name, amount]) => `${name}: ${fmtAI(amount, currency)}`)
    .join('; ')
  const largestTxs = recentTxs
    .filter((tx) => tx.amount_cents < 0)
    .sort((a, b) => Math.abs(b.amount_cents) - Math.abs(a.amount_cents))
    .slice(0, 5)
    .map((tx) => {
      const cat = catMap.get(tx.category_id)
      return `${format(new Date(tx.occurred_at), 'yyyy-MM-dd')} ${clean(tx.merchant || tx.note || cat?.name || 'Expense')}: ${fmtAI(Math.abs(tx.amount_cents), tx.currency || currency)}`
    })
    .join('; ')

  const activeHabits = input.habits.filter((h) => !h.deleted_at)
  const dueHabits = activeHabits.filter((h) => h.dueToday !== false)
  const doneHabits = dueHabits.filter((h) => (h.todayCount ?? 0) >= h.target_per_period)
  const missedHabits = dueHabits
    .filter((h) => (h.todayCount ?? 0) < h.target_per_period)
    .slice(0, 6)
    .map((h) => `${h.name} ${h.todayCount ?? 0}/${h.target_per_period}, streak ${h.streak ?? 0}d`)
    .join('; ')
  const habitLeaders = activeHabits
    .sort((a, b) => (b.streak ?? 0) - (a.streak ?? 0))
    .slice(0, 5)
    .map((h) => `${h.name}: ${h.streak ?? 0}d`)
    .join('; ')

  const activeJournals = input.journals.filter((j) => !j.deleted_at)
  const journal7 = activeJournals.filter((j) => inLastDays(j.occurred_at, now, 7))
  const journal30 = activeJournals.filter((j) => inLastDays(j.occurred_at, now, 30))
  const moods = journal30.map((j) => j.mood).filter((m): m is number => m !== null)
  const tagCounts = new Map<string, number>()
  for (const journal of journal30) {
    for (const raw of (journal.tags ?? '').split(',')) {
      const tag = raw.trim()
      if (tag) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }
  const journalSnippets = journal7
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .slice(0, 4)
    .map((j) => `${format(new Date(j.occurred_at), 'yyyy-MM-dd')}: ${clean(j.content).slice(0, 120)}`)
    .join('; ')

  const activeReminders = input.reminders.filter((r) => !r.deleted_at)
  const openReminders = activeReminders.filter((r) => r.completed !== 1)
  const inbox = openReminders.filter((r) => r.is_inbox === 1)
  const scheduledOpen = openReminders.filter((r) => r.is_inbox !== 1)
  const overdue = scheduledOpen.filter((r) => eventTime(r) < now)
  const today = scheduledOpen.filter((r) => isSameDay(eventTime(r), now))
  const upcoming = scheduledOpen
    .filter((r) => eventTime(r) >= now)
    .sort((a, b) => eventTime(a).getTime() - eventTime(b).getTime())
    .slice(0, 6)
    .map((r) => `${r.title} (${formatDateTime(eventTime(r).toISOString())}, ${r.priority})`)
    .join('; ')
  const overdueList = overdue
    .sort((a, b) => eventTime(a).getTime() - eventTime(b).getTime())
    .slice(0, 6)
    .map((r) => `${r.title} (${formatDateTime(eventTime(r).toISOString())})`)
    .join('; ')

  const activeGoals = (input.goals ?? []).filter((g) => !g.deleted_at && g.status === 'active')
  const goalLines = activeGoals
    .sort((a, b) => a.progress.percent - b.progress.percent)
    .slice(0, 6)
    .map((g) => `${g.title}: ${g.progress.percent}% (${g.progress.label}) via ${g.progress.sourceLabel || 'source'}`)
    .join('; ')

  return [
    `CONTEXT DATE: ${format(now, 'yyyy-MM-dd HH:mm')}`,
    `FINANCE: 30d income ${fmtAI(income30, currency)}, 30d expense ${fmtAI(expense30, currency)}, 7d expense ${fmtAI(expense7, currency)}, review transactions ${reviewTxs.length}. Top categories: ${topFinance || 'none'}. Largest recent expenses: ${largestTxs || 'none'}. Needs review: ${reviewTxs.slice(0, 5).join('; ') || 'none'}.`,
    `TASKS: open ${openReminders.length}, today ${today.length}, overdue ${overdue.length}, inbox ${inbox.length}, high priority open ${openReminders.filter((r) => r.priority === 'high').length}. Upcoming: ${upcoming || 'none'}. Overdue list: ${overdueList || 'none'}.`,
    `HABITS: active ${activeHabits.length}, due today ${dueHabits.length}, done today ${doneHabits.length}. Still open today: ${missedHabits || 'none'}. Best streaks: ${habitLeaders || 'none'}.`,
    `JOURNALS: 7d entries ${journal7.length}, 30d entries ${journal30.length}, 30d avg mood ${moods.length > 0 ? (moods.reduce((s, m) => s + m, 0) / moods.length).toFixed(1) : 'n/a'}, important 30d ${journal30.filter((j) => j.is_important === 1).length}. Top tags: ${topEntries(tagCounts, 6).map(([tag, count]) => `${tag}:${count}`).join('; ') || 'none'}. Recent snippets: ${journalSnippets || 'none'}.`,
    `GOALS: active ${activeGoals.length}. Lowest progress first: ${goalLines || 'none'}.`,
  ].join('\n')
}

export function buildAssistantSystemPrompt(ctx: string): string {
  const language = getAILanguage()
  const today = format(new Date(), 'yyyy-MM-dd')
  return `You are BataVasa's smart personal assistant. BataVasa tracks Finance, Tasks, Habits, Journals, and Goals.
CRITICAL: Reply in ${language} ONLY. Never switch to another language.

Today is ${today}.

Use the user's data context below as ground truth. You can answer questions about spending, budgets, review items, tasks, habits, journal mood/tags, goals, and cross-module patterns. Do not invent records, amounts, dates, or trends that are not in the context. If the context is insufficient, say what data is missing and give the best next step.

User data context:
${ctx}

Be concise, practical, specific, and non-judgmental. When useful, mention the exact module and the number/date/amount you used.`
}
