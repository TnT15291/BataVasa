import { chatCompletion } from './openai'
import { getAILanguage } from './aiLanguage'
import type { Habit, HabitLog } from '@features/habits/types'

export type HabitInsight = {
  consistency_summary: string
  strongest_habit: string
  needs_attention: string
  encouragement: string
  tip: string
}

export async function generateHabitInsight(
  habits: Habit[],
  logs: HabitLog[],
  period = 'last 30 days'
): Promise<HabitInsight | null> {
  if (habits.length === 0 || logs.length < 3) return null

  const language = getAILanguage()
  const now = new Date()
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const habitStats = habits.map((h) => {
    const habitLogs = logs.filter((l) => l.habit_id === h.id)
    const activeDays = new Set(habitLogs.map((l) => l.occurred_at.split('T')[0])).size
    return {
      name: h.name,
      cadence: h.cadence,
      target: h.target_per_period,
      completions: habitLogs.length,
      activeDays,
    }
  })

  const prompt = `Analyze these habits and return a JSON insight. Be brief, warm, and encouraging.

Today: ${localDate}
Period: ${period}
Habits:
${JSON.stringify(habitStats, null, 2)}
Total log entries: ${logs.length}

Return ONLY valid JSON with exactly this shape:
{
  "consistency_summary": "<1 sentence overall consistency pattern>",
  "strongest_habit": "<habit name and why it stands out>",
  "needs_attention": "<habit name and what to improve, or 'all habits on track' if none>",
  "encouragement": "<1 warm encouraging sentence>",
  "tip": "<1 specific actionable tip for tomorrow>"
}

Rules:
- Respond in ${language}
- Be warm, specific, non-judgmental
- Never leave a field empty or null`

  try {
    const raw = await chatCompletion(
      [
        {
          role: 'system',
          content: `You are a supportive habit coach helping users build better habits. Reply in ${language} ONLY. Return ONLY valid JSON, no explanation outside the JSON object.`,
        },
        { role: 'user', content: prompt },
      ],
      { temperature: 0.4, max_tokens: 350 }
    )
    const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0]
    if (!jsonStr) return null
    return JSON.parse(jsonStr) as HabitInsight
  } catch {
    return null
  }
}
