import { chatCompletion } from './openai'
import { getAILanguage, getAICurrency, fmtAI } from './aiLanguage'
import { withUserContext } from './userContextPrompt'
import { aiCategoryName, isDebtCategory } from './financeFormat'
import type { Transaction, Category } from '@features/finance/types'

export type ReportType = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'

function formatData(txs: Transaction[], cats: Map<string, Category>, currency: string): string {
  let income = 0
  let expense = 0
  // Spending and income are aggregated separately so income categories (Salary,
  // Other Income, …) can never be reported as "top spending". Debt-book movement
  // (Lending/Borrowing) is excluded from both — it is loan flow, not spend/earn.
  const expenseCats = new Map<string, { total: number; count: number }>()
  const incomeCats = new Map<string, { total: number; count: number }>()

  for (const tx of txs) {
    const cat = cats.get(tx.category_id)
    const abs = Math.abs(tx.amount_cents)
    if (tx.amount_cents > 0) {
      income += abs
      if (!isDebtCategory(cat)) {
        const name = aiCategoryName(cat)
        const prev = incomeCats.get(name) ?? { total: 0, count: 0 }
        incomeCats.set(name, { total: prev.total + abs, count: prev.count + 1 })
      }
    } else {
      expense += abs
      if (!isDebtCategory(cat)) {
        const name = aiCategoryName(cat)
        const prev = expenseCats.get(name) ?? { total: 0, count: 0 }
        expenseCats.set(name, { total: prev.total + abs, count: prev.count + 1 })
      }
    }
  }

  const linesFor = (m: Map<string, { total: number; count: number }>) =>
    Array.from(m.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .map(([name, d]) => `  ${name} (${d.count} txns): ${fmtAI(d.total, currency)}`)
      .join('\n')

  return [
    `Total income: ${fmtAI(income, currency)}`,
    `Total expense: ${fmtAI(expense, currency)}`,
    `Net: ${fmtAI(income - expense, currency)}`,
    `Transactions: ${txs.length}`,
    `\nExpense by category:\n${linesFor(expenseCats) || '  (none)'}`,
    `\nIncome by source:\n${linesFor(incomeCats) || '  (none)'}`,
  ].join('\n')
}

// Section topics described in English purely as guidance — the model writes the
// actual headings in the user's language (no English/emoji leak into the report).
const SECTIONS: Record<ReportType, string[]> = {
  weekly: ['Overview of the week', 'Notable spending', 'Good habits', 'Areas to improve', 'Tips for next week'],
  monthly: ['Overview of the month', 'Top spending categories', 'Trends vs the previous period', 'Overspending alerts', 'Savings', 'Goals for next month'],
  quarterly: ['Overview of the quarter', 'Top spending categories', 'Weekly breakdown', 'Trends', 'Savings', 'Goals for next quarter'],
  yearly: ['Overview of the year', 'Top spending categories', 'Monthly breakdown', 'Best and worst periods', 'Annual savings', 'Goals for next year'],
  custom: ['Overview of the period', 'Spending breakdown', 'Patterns', 'Positives', 'Insights'],
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
  const topics = SECTIONS[reportType].map((s, i) => `${i + 1}. ${s}`).join('\n')

  return chatCompletion([
    {
      role: 'system',
      content: withUserContext(`You are a finance assistant generating a report. CRITICAL: Reply in ${language} ONLY. Every heading and word MUST be written in ${language}; translate any English labels in the data (section names, category names) — never echo them. Do NOT use emojis. Be calm, practical, and non-judgmental, using concise markdown sections (## heading).`, {
        query: `${periodLabel}\n${data}`,
        domains: ['finance', 'goals', 'profile'],
        maxEntries: 8,
      }),
    },
    {
      role: 'user',
      content: `Generate a financial report for ${periodLabel}:\n\n${data}\n\nWrite one concise ## section per topic, with the heading in ${language}:\n${topics}`,
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
