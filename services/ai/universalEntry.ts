import { chatCompletion } from './openai'
import { getAILanguage, getAICurrency } from './aiLanguage'
import { extractAmount } from './smartEntry'

export type UniversalModule = 'finance' | 'reminder' | 'habits' | 'journal'

export type FinanceEntry = {
  module: 'finance'
  amount_cents: number
  direction: 'expense' | 'income'
  category_hint: string
  merchant: string
  note: string
  occurred_at: string
}

export type ReminderEntry = {
  module: 'reminder'
  title: string
  remind_at: string
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly'
  note: string
}

export type HabitsEntry = {
  module: 'habits'
  title: string
  frequency: string
}

export type JournalEntry = {
  module: 'journal'
  content: string
}

export type UniversalEntry = FinanceEntry | ReminderEntry | HabitsEntry | JournalEntry

function getLocalTzOffset(): string {
  const offsetMin = -new Date().getTimezoneOffset()
  const sign = offsetMin >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMin)
  const hh = String(Math.floor(abs / 60)).padStart(2, '0')
  const mm = String(abs % 60).padStart(2, '0')
  return `${sign}${hh}:${mm}`
}

function toLocalISOString(d: Date): string {
  const tzOffset = getLocalTzOffset()
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${tzOffset}`
  )
}

function fixReminderTimezone(isoStr: string): Date {
  // If AI returned UTC (ends with Z), reinterpret the wall-clock time as local
  if (isoStr.endsWith('Z') || isoStr.endsWith('z')) {
    const utc = new Date(isoStr)
    // Extract wall-clock parts from UTC representation
    const wallStr = isoStr.replace(/Z$/i, getLocalTzOffset())
    const local = new Date(wallStr)
    if (!isNaN(local.getTime())) return local
    return utc
  }
  return new Date(isoStr)
}

export async function parseUniversalEntry(text: string): Promise<UniversalEntry | null> {
  const language = getAILanguage()
  const currency = getAICurrency()
  const now = new Date()
  const localNow = toLocalISOString(now)
  const tzOffset = getLocalTzOffset()
  const localAmount = extractAmount(text, currency)

  const prompt = `Classify the user input and extract fields. Return ONLY valid JSON.

User input: "${text}"
Current local time: ${localNow}
User timezone: UTC${tzOffset}
Language: ${language}
Currency: ${currency}
${localAmount !== null ? `Pre-computed amount: ${localAmount} ${currency} — use this for amount_cents` : ''}

IMPORTANT: All datetime values MUST use the user's timezone offset (UTC${tzOffset}), NOT UTC. Example: "18:00" in the user's time → "2026-05-18T18:00:00${tzOffset}"

Classification rules:
- finance: mentions money/amount/spent/bought/received/sold/chi/mua/tiêu/thu
- reminder: mentions future time/date + task/meeting/appointment/họp/nhắc/lịch/remind
- habits: recurring behavior goal without specific time (exercise/eat/sleep/read/thói quen/tập/uống)
- journal: reflection/diary/memory/feeling without action items (nhớ/cảm xúc/ghi lại/kỷ niệm)

Return ONE of these JSON shapes:

Finance: {"module":"finance","amount_cents":<positive int>,"direction":"expense|income","category_hint":"<english category name>","merchant":"<store or empty string>","note":"<note or empty string>","occurred_at":"<ISO datetime with UTC${tzOffset} offset>"}

Reminder: {"module":"reminder","title":"<short task title>","remind_at":"<ISO datetime with UTC${tzOffset} offset>","recurrence":"none|daily|weekly|monthly","note":"<note or empty string>"}

Habits: {"module":"habits","title":"<habit name>","frequency":"daily|weekly|custom"}

Journal: {"module":"journal","content":"<full text>"}

Common finance categories: Food & Groceries, Transport, Housing, Utilities, Healthcare, Dining Out, Entertainment, Shopping, Subscriptions, Salary, Freelance, Other Income, Emergency Fund, Investments`

  try {
    const raw = await chatCompletion(
      [
        {
          role: 'system',
          content: `You are a JSON-only intent classifier. The user writes in ${language}. Return ONLY valid JSON, nothing else. Never add explanation. Always use UTC${tzOffset} for datetime values.`,
        },
        { role: 'user', content: prompt },
      ],
      { temperature: 0.1, max_tokens: 300 }
    )

    const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0]
    if (!jsonStr) return null

    const parsed = JSON.parse(jsonStr) as UniversalEntry

    if (!parsed.module) return null

    // Safety: if finance and we have deterministic amount, enforce it
    if (parsed.module === 'finance' && localAmount !== null) {
      const ratio = parsed.amount_cents / localAmount
      if (ratio > 10 || ratio < 0.1) parsed.amount_cents = localAmount
    }

    // Safety: reminder must have future time; fix UTC-returned times to local
    if (parsed.module === 'reminder') {
      const remindAt = fixReminderTimezone(parsed.remind_at)
      parsed.remind_at = remindAt.toISOString()
      if (isNaN(remindAt.getTime()) || remindAt < now) {
        const tomorrow = new Date(now)
        tomorrow.setDate(tomorrow.getDate() + 1)
        tomorrow.setHours(9, 0, 0, 0)
        parsed.remind_at = tomorrow.toISOString()
      }
    }

    return parsed
  } catch {
    return null
  }
}
