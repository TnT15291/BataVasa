import { chatCompletion } from './openai'
import { getAILanguage, getAICurrency, fmtAI } from './aiLanguage'
import type { Transaction, Category } from '@features/finance/types'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function weekKey(date: Date): string {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay()) // rewind to Sunday
  return d.toISOString().split('T')[0]!
}

function buildSummary(txs: Transaction[], catMap: Map<string, Category>, currency: string): string {
  let income = 0
  let expense = 0
  const catData = new Map<string, { total: number; count: number; budget: number }>()
  const merchantData = new Map<string, { total: number; count: number }>()
  const daySpend = new Array(7).fill(0) as number[]
  const weekSpend = new Map<string, number>()
  const moodData = new Map<string, { total: number; count: number }>()
  const topExpenses: { amount: number; cat: string; merchant: string; date: string }[] = []

  for (const tx of txs) {
    const abs = Math.abs(tx.amount_cents)
    const cat = catMap.get(tx.category_id)
    const catName = cat?.name ?? 'Other'
    const date = new Date(tx.occurred_at)

    if (tx.amount_cents > 0) {
      income += abs
    } else {
      expense += abs
      daySpend[date.getDay()] += abs
      weekSpend.set(weekKey(date), (weekSpend.get(weekKey(date)) ?? 0) + abs)
      if (tx.merchant?.trim()) {
        const m = tx.merchant.trim()
        const prev = merchantData.get(m) ?? { total: 0, count: 0 }
        merchantData.set(m, { total: prev.total + abs, count: prev.count + 1 })
      }
      topExpenses.push({ amount: abs, cat: catName, merchant: tx.merchant ?? '', date: date.toISOString().split('T')[0]! })
    }

    const prevCat = catData.get(catName) ?? { total: 0, count: 0, budget: cat?.monthly_budget_cents ?? 0 }
    catData.set(catName, { total: prevCat.total + abs, count: prevCat.count + 1, budget: prevCat.budget })

    if (tx.mood) {
      const prev = moodData.get(tx.mood) ?? { total: 0, count: 0 }
      moodData.set(tx.mood, { total: prev.total + abs, count: prev.count + 1 })
    }
  }

  const activeDays = new Set(txs.map((tx) => tx.occurred_at.split('T')[0])).size
  const avgDaily = activeDays > 0 ? Math.round(expense / activeDays) : 0

  // Top categories with % and budget alert
  const topCats = Array.from(catData.entries())
    .filter(([, d]) => d.total > 0)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 6)
    .map(([name, d]) => {
      const pct = expense > 0 ? Math.round((d.total / expense) * 100) : 0
      const budgetNote = d.budget > 0
        ? ` [budget: ${fmtAI(d.total, currency)}/${fmtAI(d.budget, currency)} = ${Math.round((d.total / d.budget) * 100)}%]`
        : ''
      return `  • ${name}: ${fmtAI(d.total, currency)} (${pct}%, ${d.count} txns)${budgetNote}`
    })

  // Top merchants by spend
  const topMerchants = Array.from(merchantData.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 6)
    .map(([name, d]) => `  • ${name}: ${fmtAI(d.total, currency)} (${d.count}×)`)

  // Weekly trend — last 5 weeks newest-first
  const weekTrend = Array.from(weekSpend.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 5)
    .reverse()
    .map(([w, t]) => `  ${w}: ${fmtAI(t, currency)}`)

  // Day-of-week heatmap
  const maxDay = daySpend.indexOf(Math.max(...daySpend))
  const dayRow = DAY_NAMES.map((d, i) => `${d}:${fmtAI(daySpend[i]!, currency)}`).join(' | ')

  // Top 5 individual large expenses
  const bigTxs = topExpenses
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((e, i) => `  ${i + 1}. ${e.cat}${e.merchant ? ` @ ${e.merchant}` : ''} — ${fmtAI(e.amount, currency)} on ${e.date}`)

  // Mood-spend correlation
  const moodLines = Array.from(moodData.entries())
    .map(([mood, d]) => `  ${mood}: ${d.count} txns, avg ${fmtAI(Math.round(d.total / d.count), currency)}/txn`)

  const sections: string[] = [
    `OVERVIEW\nIncome: ${fmtAI(income, currency)} | Expense: ${fmtAI(expense, currency)} | Net: ${fmtAI(income - expense, currency)}\nTransactions: ${txs.length} | Active days: ${activeDays} | Avg spend/day: ${fmtAI(avgDaily, currency)}`,
    `TOP CATEGORIES (expense only):\n${topCats.join('\n') || '  (none)'}`,
  ]

  if (topMerchants.length > 0)
    sections.push(`TOP MERCHANTS:\n${topMerchants.join('\n')}`)

  if (weekTrend.length > 1)
    sections.push(`WEEKLY TREND (oldest → newest):\n${weekTrend.join('\n')}`)

  sections.push(`DAY-OF-WEEK SPENDING:\n  ${dayRow}\n  Highest: ${DAY_NAMES[maxDay]} (${fmtAI(daySpend[maxDay]!, currency)})`)

  if (bigTxs.length > 0)
    sections.push(`LARGEST SINGLE EXPENSES:\n${bigTxs.join('\n')}`)

  if (moodLines.length > 0)
    sections.push(`MOOD WHEN SPENDING:\n${moodLines.join('\n')}`)

  return sections.join('\n\n')
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

  const hasBudgets = cats.some((c) => (c.monthly_budget_cents ?? 0) > 0)
  const budgetHint = hasBudgets
    ? 'Budget data is available in TOP CATEGORIES — flag any category that exceeded its budget.'
    : 'No category budgets are set yet. In the suggested actions section, recommend the user set monthly budgets for their top 2-3 spending categories (Settings → Categories → Edit) so future reports can show budget vs actual.'

  return chatCompletion([
    {
      role: 'system',
      content: `You are a personal finance assistant. CRITICAL: Reply in ${language} ONLY. ALL headings and content MUST be in ${language}. Be concise, specific, and non-judgmental. Use short markdown sections (## heading).`,
    },
    {
      role: 'user',
      content: `Analyze my finance data for ${period}. Be specific — reference actual numbers, merchant names, and dates from the data below. Avoid generic advice.

${summary}

Note: ${budgetHint}

Write exactly 4-5 ## sections in ${language}. Cover:
1. Tổng quan kỳ này (overview with key numbers)
2. Pattern chi tiêu đáng chú ý (specific patterns — merchants, days, categories)
3. Xu hướng & cảnh báo (weekly trend, budget alerts if any exceeded)
4. Mối liên hệ cảm xúc & tiền (mood-money if data available, skip if not)
5. 2-3 hành động cụ thể cho kỳ tới (concrete next actions referencing the actual data)`,
    },
  ])
}
