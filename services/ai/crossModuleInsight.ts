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

function buildSummary(input: CrossModuleInput, currency: string): string {
  const { transactions, categories, habits, journals } = input
  const cutoff = subDays(new Date(), 30).toISOString()
  const recentTxs = transactions.filter((t) => t.occurred_at >= cutoff)
  const recentJournals = journals.filter((j) => j.occurred_at >= cutoff)

  const sections: string[] = []

  if (recentTxs.length > 0) {
    const catMap = new Map(categories.map((c) => [c.id, c]))
    let income = 0, expense = 0
    const catTotals = new Map<string, number>()
    for (const tx of recentTxs) {
      const name = catMap.get(tx.category_id)?.name ?? 'Other'
      if (tx.amount_cents > 0) income += tx.amount_cents
      else expense += Math.abs(tx.amount_cents)
      catTotals.set(name, (catTotals.get(name) ?? 0) + Math.abs(tx.amount_cents))
    }
    const topCats = Array.from(catTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, amt]) => `  ${name}: ${fmtAI(amt, currency)}`)
      .join('\n')
    sections.push(`FINANCE (last 30 days):\n  Income: ${fmtAI(income, currency)}\n  Expense: ${fmtAI(expense, currency)}\n  Top categories:\n${topCats}`)
  }

  if (habits.length > 0) {
    const habitSummary = habits
      .map((h) => `  ${h.icon} ${h.name} (${h.cadence}): streak ${h.streak} days, done today: ${h.todayCount}/${h.target_per_period}`)
      .join('\n')
    sections.push(`HABITS:\n${habitSummary}`)
  }

  if (recentJournals.length > 0) {
    const withMood = recentJournals.filter((j) => j.mood != null)
    const avgMood = withMood.length > 0
      ? (withMood.reduce((s, j) => s + (j.mood ?? 0), 0) / withMood.length).toFixed(1)
      : 'N/A'
    const snippets = recentJournals.slice(0, 5)
      .map((j) => `  [mood:${j.mood ?? '?'}] ${j.content.slice(0, 80)}`)
      .join('\n')
    sections.push(`JOURNALS (${recentJournals.length} entries, last 30 days):\n  Avg mood: ${avgMood}/5\n  Samples:\n${snippets}`)
  }

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
      content: `You are a holistic personal life assistant analyzing Finance, Habits, and Journal data together. CRITICAL: Reply in ${language} ONLY. Find meaningful cross-module patterns. Be concise, practical, empathetic. Use emojis.`,
    },
    {
      role: 'user',
      content: `Analyze my personal data from the last 30 days:\n\n${summary}\n\nProvide:\n1. Cross-module correlations (mood vs spending, habits vs financial discipline, etc.)\n2. Overall wellness score (1-10) with brief reasoning\n3. Top 3 insights spanning multiple areas\n4. One actionable recommendation for this week`,
    },
  ])
}
