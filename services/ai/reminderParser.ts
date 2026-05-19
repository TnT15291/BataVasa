import { chatCompletion } from './openai'
import { getAILanguage } from './aiLanguage'

export type ParsedReminder = {
  title: string
  note: string
  remind_at: string
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

Return JSON:
{
  "title": "<brief reminder title>",
  "note": "<extra details, empty string if none>",
  "remind_at": "<ISO8601 datetime for when to remind>",
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
    return {
      title: String(parsed.title),
      note: String(parsed.note ?? ''),
      remind_at: String(parsed.remind_at),
      recurrence: validRecurrence.includes(parsed.recurrence) ? parsed.recurrence : 'none',
    }
  } catch {
    return null
  }
}
