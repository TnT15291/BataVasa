import { chatCompletion } from './openai'
import { getAILanguage } from './aiLanguage'
import type { Journal } from '@features/journals/types'

export type JournalReflection = {
  mood_summary: string
  themes: string[]
  recurring_questions: string[]
  gentle_prompt: string
}

export async function generateJournalReflection(
  journals: Journal[]
): Promise<JournalReflection | null> {
  if (journals.length < 3) return null

  const language = getAILanguage()
  const now = new Date()
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const MOOD_LABEL: Record<number, string> = { 1: 'very sad', 2: 'sad', 3: 'neutral', 4: 'happy', 5: 'very happy' }

  const entries = journals.slice(0, 30).map((j) => ({
    date: j.occurred_at.split('T')[0],
    mood: j.mood ? MOOD_LABEL[j.mood] : 'unspecified',
    preview: j.content.slice(0, 200),
  }))

  const prompt = `Analyze these journal entries and return a gentle, insightful reflection. Return ONLY valid JSON.

Today: ${localDate}
Entries (most recent first):
${JSON.stringify(entries, null, 2)}

Return this JSON shape:
{
  "mood_summary": "<1 sentence about overall mood pattern>",
  "themes": ["<theme 1>", "<theme 2>", "<theme 3>"],
  "recurring_questions": ["<something user keeps revisiting>"],
  "gentle_prompt": "<one warm question to reflect on next>"
}

Rules:
- Respond in ${language}
- Be warm, non-judgmental, and brief
- Never diagnose or prescribe clinical action
- Themes should be 2-4 items, concrete and specific`

  try {
    const raw = await chatCompletion(
      [
        {
          role: 'system',
          content: `You are a thoughtful, gentle reflection partner. The user writes in ${language}. Return ONLY valid JSON. Never add explanation outside the JSON.`,
        },
        { role: 'user', content: prompt },
      ],
      { temperature: 0.4, max_tokens: 400 }
    )

    const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0]
    if (!jsonStr) return null
    return JSON.parse(jsonStr) as JournalReflection
  } catch {
    return null
  }
}
