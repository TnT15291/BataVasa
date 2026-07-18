import { chatCompletion } from '@services/ai/openai'
import { getAILanguage } from '@services/ai/aiLanguage'
import { dateOnlyFromAI, localDateString, toLocalISOString, getLocalTzOffset } from '@services/localTime'
import type { Category } from '@features/finance/types'
import type { Habit } from '@features/habits/types'

export type ParsedGoal = {
  title: string
  description: string
  source: 'finance' | 'habits' | 'journals' | 'reminders'
  source_hint: string
  target_value: number
  // Only meaningful when source === 'habits': whether the goal tracks a % of
  // scheduled days (completion_rate) or a raw number of sessions (completion_count).
  habit_aggregation: 'completion_rate' | 'completion_count'
  start_date: string
  due_date: string | null
}

type ParseOptions = {
  categories: Category[]
  habits: Habit[]
  journalTags: readonly string[]
  currency: string
}

function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Ä‘/g, 'd')
    .replace(/Ä/g, 'D')
    .toLowerCase()
}

function dateOnly(value: unknown): string | null {
  return dateOnlyFromAI(value)
}

// Habit goals are always tracked by number of completed sessions (count). The
// target is derived deterministically from the text ("100 lần" → 100), never
// from the AI's number. A per-session quantity (5km, 30 phút, 10 trang) is NOT
// the target — it stays in the title/description.
function detectHabitGoal(originalText: string): { aggregation: ParsedGoal['habit_aggregation']; target: number } {
  const folded = foldText(originalText)
  // "30 buổi", "100 lần", "30 sessions" → that many completions.
  const count = folded.match(/(\d{1,3})\s*(?:buoi|lan|session|sessions|time|times)\b/)
  if (count) {
    const n = Number(count[1])
    if (n > 0) return { aggregation: 'completion_count', target: Math.min(999, Math.round(n)) }
  }
  // No explicit number → a month of sessions as a sensible starting target.
  return { aggregation: 'completion_count', target: 30 }
}

function isUnsupportedGoal(text: string): boolean {
  const folded = foldText(text)
  const hasSessionCount = /(\d{1,3})\s*(?:buoi|lan|session|sessions|time|times)\b/.test(folded)
  const asksToWrite = /\b(viet|ghi|journal|journaling|write|reflect|reflection)\b/.test(folded)
  const asksTaskCount = /\b(hoan thanh|xong|complete|finish|tasks?|viec)\b/.test(folded) && /\d/.test(folded)

  if (/\b(giam|tang|lose|gain)\b.*\d+\s*(kg|kgs|kilogram|kilograms|can|pound|pounds|lbs)\b/.test(folded)) return true
  if (/\b(ngu|sleep)\b.*\d+\s*(h|hr|hrs|hour|hours|tieng)\b/.test(folded) && !hasSessionCount) return true
  if (/\b(mood|tam trang|hanh phuc|happy|happier|vui ve)\b/.test(folded) && !asksToWrite) return true
  if (/\b(overdue|qua han|tre han)\b/.test(folded)) return true
  if (/\b(no|debt|loan|borrow|borrowed|lend|lent|vay)\b/.test(folded)) return true
  if (/\b(streak|chuoi)\b/.test(folded) && !hasSessionCount) return true
  if (/\b(net worth|tai san rong)\b/.test(folded)) return true
  if (!asksToWrite && !asksTaskCount && /\b(stress|cang thang)\b/.test(folded) && !hasSessionCount) return true
  return false
}

export async function parseGoalEntry(text: string, opts: ParseOptions): Promise<ParsedGoal | null> {
  if (isUnsupportedGoal(text)) return null

  const language = getAILanguage()
  const today = localDateString()
  const localNow = toLocalISOString()
  const tzOffset = getLocalTzOffset()
  const categories = opts.categories.map((c) => `${c.name} (${c.kind})`).join(', ') || 'none'
  const habits = opts.habits.map((h) => h.name).join(', ') || 'none'
  const journalTags = opts.journalTags.join(', ')

  const raw = await chatCompletion([
    {
      role: 'system',
      content: `You parse natural language personal goals into structured JSON. CRITICAL: Reply ONLY with valid JSON, no markdown. Reply text fields in ${language}.`,
    },
    {
      role: 'user',
      content: `Parse this goal: "${text}"

Today: ${today}
Current local time: ${localNow}
User timezone: UTC${tzOffset}
Currency: ${opts.currency}
Available finance categories: ${categories}
Available habits: ${habits}
Available journal tags: ${journalTags}

Choose source:
- finance: money, saving, income, spending, budget goals. source_hint should match an available finance category name when possible.
- habits: completion-rate or routine consistency goals. source_hint should match an available habit name when possible.
- journals: writing/reflection/count goals. source_hint must be one journal tag, or "all".
- reminders: completed-task goals. source_hint should be empty.

Supported goals only:
- finance amount/cap goals, habit session-count goals, journal-entry count goals, and completed-task count goals.
- If the goal requires data BataVasa does not track directly (weight, sleep duration, average mood, overdue-task cap, debt by person, net worth, true streak), return {"unsupported":true}.

Target rules:
- finance target_value is the human display amount in ${opts.currency}, not cents.
- habits target_value is the number of sessions/times to complete (e.g. 30, 100).
- For habits, do NOT use distance/time/quantity literals like 5km, 30 minutes, or 10 pages as target_value; keep those in title, description, or source_hint.
- journals/reminders target_value is an entry/task count.
- If no start date is stated, use today.
- If no due date is stated, use null.

Return JSON:
{
  "title": "<short goal title>",
  "description": "<optional detail, empty string if none>",
  "source": "finance" | "habits" | "journals" | "reminders",
  "source_hint": "<best matching category, habit, journal tag, or empty>",
  "target_value": <number>,
  "start_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD" | null
}`,
    },
  ], { temperature: 0.1, max_tokens: 700 })

  try {
    const json = raw.match(/\{[\s\S]*\}/)?.[0]
    if (!json) return null
    const parsed = JSON.parse(json)
    if (parsed.unsupported === true) return null
    const source = ['finance', 'habits', 'journals', 'reminders'].includes(parsed.source)
      ? parsed.source as ParsedGoal['source']
      : 'finance'
    const targetValue = Number(parsed.target_value)
    const start = dateOnly(parsed.start_date) ?? today
    const due = dateOnly(parsed.due_date)
    const title = String(parsed.title ?? '').trim()
    if (!title || !Number.isFinite(targetValue) || targetValue <= 0) return null
    const habit = source === 'habits' ? detectHabitGoal(text) : null
    return {
      title,
      description: String(parsed.description ?? '').trim(),
      source,
      source_hint: String(parsed.source_hint ?? '').trim(),
      target_value: habit ? habit.target : targetValue,
      habit_aggregation: habit ? habit.aggregation : 'completion_rate',
      start_date: start,
      due_date: due,
    }
  } catch {
    return null
  }
}
