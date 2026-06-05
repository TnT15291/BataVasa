import { chatCompletion } from './openai'
import { getAILanguage, getAICurrency, fmtAI } from './aiLanguage'
import { subDays } from 'date-fns'
import type { Transaction, Category } from '@features/finance/types'
import type { Habit } from '@features/habits/types'
import type { Journal } from '@features/journals/types'

type HabitWithStats = Habit & { todayCount: number; streak: number }

type CrossModuleInput = {
  transactions: Transaction[]
  categories: Category[]
  habits: HabitWithStats[]
  journals: Journal[]
}

type DayStat = {
  expense: number
  income: number
  mood: number | null
  journalCount: number
}

function buildDayStats(
  txs: Transaction[],
  journals: Journal[],
  cutoff: string,
): Map<string, DayStat> {
  const days = new Map<string, DayStat>()
  const blank = (): DayStat => ({ expense: 0, income: 0, mood: null, journalCount: 0 })

  for (const tx of txs) {
    if (tx.occurred_at < cutoff) continue
    const date = tx.occurred_at.split('T')[0]!
    const d = days.get(date) ?? blank()
    if (tx.amount_cents < 0) d.expense += Math.abs(tx.amount_cents)
    else d.income += tx.amount_cents
    days.set(date, d)
  }

  for (const j of journals) {
    if (j.occurred_at < cutoff) continue
    const date = j.occurred_at.split('T')[0]!
    const d = days.get(date) ?? blank()
    if (j.mood != null) d.mood = j.mood
    d.journalCount++
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
  const highMoods = highSpend.filter((d) => d.mood != null)
  const lowMoods = lowSpend.filter((d) => d.mood != null)
  if (highMoods.length >= 2 && lowMoods.length >= 2) {
    const avgHighMood = (highMoods.reduce((s, d) => s + (d.mood ?? 0), 0) / highMoods.length).toFixed(1)
    const avgLowMood = (lowMoods.reduce((s, d) => s + (d.mood ?? 0), 0) / lowMoods.length).toFixed(1)
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

function buildSummary(input: CrossModuleInput, currency: string): string {
  const { transactions, categories, habits, journals } = input
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
      else expense += abs
      catTotals.set(name, (catTotals.get(name) ?? 0) + abs)
    }
    const topCats = Array.from(catTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, amt]) => `  ${name}: ${fmtAI(amt, currency)}`)
    sections.push(`FINANCE (last 30 days):\n  Income: ${fmtAI(income, currency)} | Expense: ${fmtAI(expense, currency)} | Net: ${fmtAI(income - expense, currency)}\n  Top categories:\n${topCats.join('\n')}`)
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

  // Cross-module correlation block
  const dayStats = buildDayStats(recentTxs, recentJournals, cutoff)
  const corr = correlationBlock(dayStats, currency)
  if (corr) sections.push(`CROSS-MODULE PATTERNS:\n${corr}`)

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
      content: `Analyze my personal data from the last 30 days. Be specific — reference actual numbers, dates, and patterns from the data. Do not give generic advice.

${summary}

Write 4-5 ## sections in ${language}. Cover:
1. Tổng kết tháng (key highlights across all modules)
2. Pattern đáng chú ý (cross-module patterns — especially spending↔mood or habits↔mood correlations from the CROSS-MODULE PATTERNS section if available)
3. Điểm mạnh & điểm cần cải thiện (reference specific data points)
4. Điểm giao thoa (how finance, habits, and journals connect in your life this month)
5. 2-3 hành động ưu tiên cho tháng tới (concrete, specific to the data)`,
    },
  ])
}
