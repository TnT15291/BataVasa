import { chatCompletion } from '@services/ai/openai'
import { getAILanguage } from '@services/ai/aiLanguage'
import type { Category } from '@features/finance/types'
import type { Habit } from '@features/habits/types'

export type ParsedGoal = {
  title: string
  description: string
  source: 'finance' | 'habits' | 'journals' | 'reminders'
  source_hint: string
  target_value: number
  start_date: string
  due_date: string | null
}

type ParseOptions = {
  categories: Category[]
  habits: Habit[]
  journalTags: readonly string[]
  currency: string
}

function dateOnly(value: unknown): string | null {
  if (!value) return null
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) {
    const raw = String(value).trim()
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null
  }
  return parsed.toISOString().slice(0, 10)
}

function normalizeHabitGoalTarget(value: number, originalText: string): number {
  const rounded = Math.round(value)
  const folded = originalText
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
  const hasQuantityUnit = /\b\d+(?:[.,]\d+)?\s*(km|kilometer|kilometre|m|meter|metre|phut|minute|min|gio|hour|h|ngay|day|lan|rep|reps|page|trang)\b/.test(folded)
  if (!Number.isFinite(value) || value <= 0 || rounded < 20 || (hasQuantityUnit && rounded < 50)) return 100
  return Math.min(100, rounded)
}

export async function parseGoalEntry(text: string, opts: ParseOptions): Promise<ParsedGoal | null> {
  const language = getAILanguage()
  const today = new Date().toISOString().slice(0, 10)
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
Currency: ${opts.currency}
Available finance categories: ${categories}
Available habits: ${habits}
Available journal tags: ${journalTags}

Choose source:
- finance: money, saving, income, spending, budget goals. source_hint should match an available finance category name when possible.
- habits: completion-rate or routine consistency goals. source_hint should match an available habit name when possible.
- journals: writing/reflection/count goals. source_hint must be one journal tag, or "all".
- reminders: completed-task goals. source_hint should be empty.

Target rules:
- finance target_value is the human display amount in ${opts.currency}, not cents.
- habits target_value is a completion-rate percent from 1 to 100, normally 100 for a completed goal.
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
    const source = ['finance', 'habits', 'journals', 'reminders'].includes(parsed.source)
      ? parsed.source as ParsedGoal['source']
      : 'finance'
    const targetValue = Number(parsed.target_value)
    const start = dateOnly(parsed.start_date) ?? today
    const due = dateOnly(parsed.due_date)
    const title = String(parsed.title ?? '').trim()
    if (!title || !Number.isFinite(targetValue) || targetValue <= 0) return null
    return {
      title,
      description: String(parsed.description ?? '').trim(),
      source,
      source_hint: String(parsed.source_hint ?? '').trim(),
      target_value: source === 'habits' ? normalizeHabitGoalTarget(targetValue, text) : targetValue,
      start_date: start,
      due_date: due,
    }
  } catch {
    return null
  }
}
