import { chatCompletion } from '@services/ai/openai'
import { getAILanguage } from '@services/ai/aiLanguage'

export type ParsedJournal = {
  content: string
  mood: number | null
  is_important: number
  occurred_at: string
}

function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

function inferMoodFromText(text: string): number | null {
  const t = foldText(text)
  if (/\b(tuyet voi|hanh phuc|phan khoi|rat vui|very happy|excited|amazing)\b/.test(t)) return 5
  if (/\b(vui|tu hao|biet on|happy|proud|grateful|glad)\b/.test(t)) return 4
  if (/\b(rat buon|tuyet vong|khung khiep|very sad|devastated)\b/.test(t)) return 1
  if (/\b(buon|met moi|cang thang|lo lang|that vong|sad|tired|stressed|anxious|disappointed)\b/.test(t)) return 2
  return null
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
  "is_important": <1 if this sounds like a significant life event, milestone, strong emotion, decision, health/family/work/money event, or something the user may want to revisit later; otherwise 0>,
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
    const normalizedMood = mood != null && mood >= 1 && mood <= 5 ? Math.round(mood) : null
    return {
      content: String(parsed.content),
      mood: normalizedMood ?? inferMoodFromText(text),
      is_important: Number(parsed.is_important) === 1 ? 1 : 0,
      occurred_at: String(parsed.occurred_at),
    }
  } catch {
    return null
  }
}
