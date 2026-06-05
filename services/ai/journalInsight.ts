import { chatCompletion } from './openai'
import { getAILanguage } from './aiLanguage'
import type { Journal } from '@features/journals/types'

export type JournalReflection = {
  mood_summary: string
  themes: string[]
  recurring_questions: string[]
  gentle_prompt: string
}

const MOOD_LABEL: Record<number, string> = {
  1: 'very sad (1)',
  2: 'sad (2)',
  3: 'neutral (3)',
  4: 'happy (4)',
  5: 'very happy (5)',
}

function moodTrend(journals: Journal[]): string {
  const withMood = journals.filter((j) => j.mood != null)
  if (withMood.length < 4) return 'not enough data'
  const half = Math.floor(withMood.length / 2)
  const olderAvg = withMood.slice(half).reduce((s, j) => s + (j.mood ?? 0), 0) / (withMood.length - half)
  const recentAvg = withMood.slice(0, half).reduce((s, j) => s + (j.mood ?? 0), 0) / half
  const diff = recentAvg - olderAvg
  if (diff > 0.4) return `improving (${olderAvg.toFixed(1)} → ${recentAvg.toFixed(1)})`
  if (diff < -0.4) return `declining (${olderAvg.toFixed(1)} → ${recentAvg.toFixed(1)})`
  return `stable (avg ${recentAvg.toFixed(1)}/5)`
}

function moodHistogram(journals: Journal[]): string {
  const counts = new Array(6).fill(0) as number[]
  for (const j of journals) {
    if (j.mood != null) counts[j.mood]++
  }
  return [1, 2, 3, 4, 5]
    .filter((level) => counts[level]! > 0)
    .map((level) => `${MOOD_LABEL[level]}: ${counts[level]} entries`)
    .join(', ')
}

function entryFrequency(journals: Journal[]): string {
  const weekCounts = new Map<string, number>()
  for (const j of journals) {
    const d = new Date(j.occurred_at)
    const sun = new Date(d)
    sun.setDate(d.getDate() - d.getDay())
    const key = sun.toISOString().split('T')[0]!
    weekCounts.set(key, (weekCounts.get(key) ?? 0) + 1)
  }
  const weeks = weekCounts.size
  const avg = weeks > 0 ? (journals.length / weeks).toFixed(1) : '0'
  return `${journals.length} entries over ${weeks} weeks (avg ${avg}/week)`
}

function buildSummary(journals: Journal[]): string {
  const sorted = [...journals].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
  const importantCount = sorted.filter((j) => j.is_important === 1).length

  // Mood stats
  const withMood = sorted.filter((j) => j.mood != null)
  const avgMood = withMood.length > 0
    ? (withMood.reduce((s, j) => s + (j.mood ?? 0), 0) / withMood.length).toFixed(2)
    : 'N/A'

  const sections: string[] = [
    `STATS: ${entryFrequency(sorted)} | avg mood: ${avgMood}/5 | important entries: ${importantCount}`,
    `MOOD TREND: ${moodTrend(sorted)}`,
    withMood.length > 0 ? `MOOD DISTRIBUTION: ${moodHistogram(sorted)}` : '',
    `ENTRIES (most recent first, ★=important):`,
    ...sorted.slice(0, 25).map((j) => {
      const flag = j.is_important === 1 ? '★ ' : ''
      const moodTag = j.mood != null ? ` [mood:${j.mood}]` : ''
      const date = j.occurred_at.split('T')[0]
      return `  [${date}]${moodTag} ${flag}${j.content.slice(0, 350).replace(/\n+/g, ' ')}`
    }),
  ]

  return sections.filter(Boolean).join('\n')
}

export async function generateJournalReflection(
  journals: Journal[],
): Promise<JournalReflection | null> {
  if (journals.length < 3) return null

  const language = getAILanguage()
  const today = new Date()
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const summary = buildSummary(journals)

  const prompt = `Analyze these journal entries and return a thoughtful reflection. Be specific — reference actual dates, moods, and content from the entries below.

Today: ${localDate}

${summary}

Return ONLY valid JSON:
{
  "mood_summary": "<1-2 sentences about mood pattern, reference the trend direction and any notable shifts>",
  "themes": ["<specific theme 1 with evidence>", "<specific theme 2>", "<specific theme 3>"],
  "recurring_questions": ["<something the user keeps revisiting, with example>"],
  "gentle_prompt": "<one warm specific question to reflect on next, tied to the dominant theme>"
}

Rules:
- Respond in ${language}
- Be warm, non-judgmental, and specific — quote dates or content fragments when helpful
- Themes should be 2-4 items, concrete and grounded in actual entries
- Never diagnose or prescribe clinical action`

  try {
    const raw = await chatCompletion(
      [
        {
          role: 'system',
          content: `You are a thoughtful reflection partner. Reply in ${language} ONLY. Return ONLY valid JSON. Never add explanation outside the JSON.`,
        },
        { role: 'user', content: prompt },
      ],
      { temperature: 0.4, max_tokens: 500 },
    )
    const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0]
    if (!jsonStr) return null
    return JSON.parse(jsonStr) as JournalReflection
  } catch {
    return null
  }
}
