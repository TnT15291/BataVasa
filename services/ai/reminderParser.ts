import { chatCompletion } from './openai'
import { getAILanguage } from './aiLanguage'

export type ParsedReminder = {
  title: string
  note: string
  remind_at: string         // the event/appointment datetime
  advance_minutes: number   // minutes before the event to notify (0 = at event time)
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly'
}

export async function parseReminderEntry(text: string): Promise<ParsedReminder | null> {
  const language = getAILanguage()
  const today = new Date().toISOString()

  const raw = await chatCompletion([
    {
      role: 'system',
      content: `You parse natural language reminder requests into structured JSON. CRITICAL: Reply ONLY with valid JSON, no other text. Reply in ${language}.`,
    },
    {
      role: 'user',
      content: `Parse this reminder: "${text}"

Today's datetime: ${today}

Look for phrases like "remind X min/hours/days before" or "nhắc trước X phút/giờ/ngày" and convert to advance_minutes.
Examples: "nhắc trước 30 phút" → advance_minutes: 30, "nhắc trước 1 ngày" → advance_minutes: 1440, "nhắc trước 2 tiếng" → advance_minutes: 120.

Return JSON:
{
  "title": "<brief reminder title>",
  "note": "<extra details, empty string if none>",
  "remind_at": "<ISO8601 datetime of the actual event/appointment>",
  "advance_minutes": <integer minutes before event to notify, 0 if not specified>,
  "recurrence": <"none"|"daily"|"weekly"|"monthly">
}`,
    },
  ])

  try {
    const json = raw.match(/\{[\s\S]*\}/)?.[0]
    if (!json) return null
    const parsed = JSON.parse(json)
    if (!parsed.title || !parsed.remind_at) return null
    const validRecurrence = ['none', 'daily', 'weekly', 'monthly']
    const advMins = Number(parsed.advance_minutes ?? 0)
    return {
      title: String(parsed.title),
      note: String(parsed.note ?? ''),
      remind_at: String(parsed.remind_at),
      advance_minutes: isNaN(advMins) || advMins < 0 ? 0 : Math.round(advMins),
      recurrence: validRecurrence.includes(parsed.recurrence) ? parsed.recurrence : 'none',
    }
  } catch {
    return null
  }
}
