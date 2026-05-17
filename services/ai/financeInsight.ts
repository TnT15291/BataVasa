import { chatCompletion } from './openai'
import { getAILanguage, getAICurrency, fmtAI } from './aiLanguage'
import type { Transaction, Category } from '@features/finance/types'

function buildSummary(txs: Transaction[], catMap: Map<string, Category>, currency: string): string {
  let income = 0
  let expense = 0
  const catTotals = new Map<string, number>()
  const moodCounts = new Map<string, number>()

  for (const tx of txs) {
    const name = catMap.get(tx.category_id)?.name ?? 'Other'
    const abs = Math.abs(tx.amount_cents)
    if (tx.amount_cents > 0) income += abs
    else expense += abs
    catTotals.set(name, (catTotals.get(name) ?? 0) + abs)
    if (tx.mood) moodCounts.set(tx.mood, (moodCounts.get(tx.mood) ?? 0) + 1)
  }

  const catBreakdown = Array.from(catTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, total]) => `  - ${name}: ${fmtAI(total, currency)}`)
    .join('\n')

  const moodBreakdown = Array.from(moodCounts.entries())
    .map(([mood, count]) => `${mood}: ${count}`)
    .join(', ')

  return [
    `Income: ${fmtAI(income, currency)}`,
    `Expense: ${fmtAI(expense, currency)}`,
    `Net: ${fmtAI(income - expense, currency)}`,
    `Transactions: ${txs.length}`,
    moodBreakdown ? `Mood when spending: ${moodBreakdown}` : '',
    `\nBy category:\n${catBreakdown}`,
  ]
    .filter(Boolean)
    .join('\n')
}

export async function generateFinanceInsights(
  txs: Transaction[],
  cats: Category[],
  period = 'last 30 days'
): Promise<string> {
  if (txs.length === 0) throw new Error('NO_DATA')
  const language = getAILanguage()
  const currency = getAICurrency()
  const catMap = new Map(cats.map((c) => [c.id, c]))
  const summary = buildSummary(txs, catMap, currency)

  return chatCompletion([
    {
      role: 'system',
      content: `You are a smart personal finance assistant. CRITICAL: Reply in ${language} ONLY, no other language. Be concise, practical, use emojis.`,
    },
    {
      role: 'user',
      content: `Analyze my spending for the ${period}:\n\n${summary}\n\nPlease analyze:\n1. Overall financial health\n2. Top spending categories\n3. Overspending warnings\n4. Specific saving suggestions\n5. Positive habits to maintain`,
    },
  ])
}
