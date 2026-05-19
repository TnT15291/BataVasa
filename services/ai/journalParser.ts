import { chatCompletion } from './openai'
import { getAILanguage } from './aiLanguage'

export type ParsedJournal = {
  content: string
  mood: number | null
  occurred_at: string
}

export async function parseJournalEntry(text: string): Promise<ParsedJournal | null> {
  const language = getAILanguage()
  const today = new Date().toISOString()

  const raw = await chatCompletion([
    {
      role: 'system',
      content: `You parse natural language journal entries into structured JSON. CRITICAL: Reply ONLY with valid JSON, no other text. Reply in ${language}.`,
    },
    {
      role: 'user',
      content: `Parse this journal entry: "${text}"

Today's datetime: ${today}

Return JSON:
{
  "content": "<the journal entry text, cleaned and complete>",
  "mood": <integer 1-5 inferred from sentiment, or null if unclear. 1=very sad, 2=sad, 3=neutral, 4=happy, 5=very happy>,
  "occurred_at": "<ISO8601 datetime — use today if not specified>"
}`,
    },
  ])

  try {
    const json = raw.match(/\{[\s\S]*\}/)?.[0]
    if (!json) return null
    const parsed = JSON.parse(json)
    if (!parsed.content || !parsed.occurred_at) return null
    const mood = parsed.mood != null ? Number(parsed.mood) : null
    return {
      content: String(parsed.content),
      mood: mood != null && mood >= 1 && mood <= 5 ? Math.round(mood) : null,
      occurred_at: String(parsed.occurred_at),
    }
  } catch {
    return null
  }
}
