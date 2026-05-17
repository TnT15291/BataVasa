import { chatCompletion } from './openai'
import { getAILanguage, getAICurrency, fmtAI } from './aiLanguage'
import type { Transaction, Category } from '@features/finance/types'

export type ReportType = 'weekly' | 'monthly' | 'yearly' | 'custom'

function formatData(txs: Transaction[], cats: Map<string, Category>, currency: string): string {
  let income = 0
  let expense = 0
  const catTotals = new Map<string, { total: number; count: number }>()

  for (const tx of txs) {
    const name = cats.get(tx.category_id)?.name ?? 'Other'
    const abs = Math.abs(tx.amount_cents)
    if (tx.amount_cents > 0) income += abs
    else expense += abs
    const prev = catTotals.get(name) ?? { total: 0, count: 0 }
    catTotals.set(name, { total: prev.total + abs, count: prev.count + 1 })
  }

  const catLines = Array.from(catTotals.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .map(([name, d]) => `  ${name} (${d.count} txns): ${fmtAI(d.total, currency)}`)
    .join('\n')

  return [
    `Total income: ${fmtAI(income, currency)}`,
    `Total expense: ${fmtAI(expense, currency)}`,
    `Net: ${fmtAI(income - expense, currency)}`,
    `Transactions: ${txs.length}`,
    `\nBy category:\n${catLines || '  (none)'}`,
  ].join('\n')
}

const SECTIONS: Record<ReportType, string> = {
  weekly:
    '## 📊 Weekly Overview\n## 💸 Notable Spending\n## ✅ Good Habits\n## ⚠️ Areas to Improve\n## 💡 Tips for Next Week',
  monthly:
    '## 📊 Monthly Overview\n## 🏆 Top Categories\n## 📈 Trends\n## 🚨 Overspending Alerts\n## 💰 Savings\n## 🎯 Goals for Next Month',
  yearly:
    '## 📊 Annual Overview\n## 🏆 Top Categories\n## 📈 Monthly Breakdown\n## 🏅 Best & Worst Periods\n## 💰 Annual Savings\n## 🎯 Goals for Next Year',
  custom:
    '## 📊 Period Overview\n## 💸 Spending Breakdown\n## 📈 Patterns\n## ✅ Positives\n## 💡 Insights',
}

export async function generateReport(
  txs: Transaction[],
  cats: Category[],
  periodLabel: string,
  reportType: ReportType = 'monthly'
): Promise<string> {
  if (txs.length === 0) throw new Error('NO_DATA')
  const language = getAILanguage()
  const currency = getAICurrency()
  const data = formatData(txs, new Map(cats.map((c) => [c.id, c])), currency)

  return chatCompletion([
    {
      role: 'system',
      content: `You are a finance assistant generating a report. CRITICAL: Reply in ${language} ONLY using markdown with emojis.`,
    },
    {
      role: 'user',
      content: `Generate a financial report for ${periodLabel}:\n\n${data}\n\nInclude:\n${SECTIONS[reportType]}`,
    },
  ])
}

// Backward-compat wrappers
export async function generateWeeklyReport(txs: Transaction[], cats: Category[]): Promise<string> {
  return generateReport(txs, cats, 'this week', 'weekly')
}
export async function generateMonthlyReport(txs: Transaction[], cats: Category[]): Promise<string> {
  return generateReport(txs, cats, 'this month', 'monthly')
}
