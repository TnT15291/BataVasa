import { chatCompletion } from '@services/ai/openai'
import { getAILanguage } from '@services/ai/aiLanguage'
import type { Habit } from './types'

export type ParsedHabitLog = {
  matched_habit_id: string | null
  matched_habit_name: string
  occurred_at: string
  note: string
}

export async function parseHabitLog(text: string, habits: Habit[]): Promise<ParsedHabitLog | null> {
  const language = getAILanguage()
  const today = new Date().toISOString()
  const habitList = habits.map((h) => `id:${h.id} name:"${h.name}" icon:${h.icon}`).join('\n')

  const raw = await chatCompletion([
    {
      role: 'system',
      content: `You parse natural language habit log entries into structured JSON. CRITICAL: Reply ONLY with valid JSON, no other text. Reply in ${language}.`,
    },
    {
      role: 'user',
      content: `Parse this habit log entry: "${text}"

Today's datetime: ${today}
Available habits:
${habitList || '(none)'}

Return JSON:
{
  "matched_habit_id": "<id from the list that best matches, or null>",
  "matched_habit_name": "<name of matched habit, or best guess>",
  "occurred_at": "<ISO8601 datetime — use today if not specified>",
  "note": "<any extra context, empty string if none>"
}`,
    },
  ])

  try {
    const json = raw.match(/\{[\s\S]*\}/)?.[0]
    if (!json) return null
    const parsed = JSON.parse(json)
    if (!parsed.matched_habit_name || !parsed.occurred_at) return null
    const matchedHabit = parsed.matched_habit_id
      ? habits.find((h) => h.id === parsed.matched_habit_id) ?? null
      : null
    return {
      matched_habit_id: parsed.matched_habit_id ?? null,
      matched_habit_name: matchedHabit?.name ?? String(parsed.matched_habit_name),
      occurred_at: String(parsed.occurred_at),
      note: String(parsed.note ?? ''),
    }
  } catch {
    return null
  }
}
