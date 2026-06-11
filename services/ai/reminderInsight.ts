import { chatCompletion } from './openai'
import { getAILanguage } from './aiLanguage'
import type { Reminder } from '@features/reminders/types'

export type ReminderInsight = {
  pattern_summary: string
  completion_insight: string
  overdue_insight: string
  tip: string
}

function buildSummary(reminders: Reminder[]): string {
  const total = reminders.length
  const completed = reminders.filter((r) => r.completed === 1).length
  const overdue = reminders.filter((r) => r.completed === 0 && new Date(r.remind_at) < new Date()).length
  const inbox = reminders.filter((r) => (r.is_inbox ?? 0) === 1).length
  const byPriority = { high: 0, medium: 0, low: 0 }
  const completedByPriority = { high: 0, medium: 0, low: 0 }
  for (const r of reminders) {
    const p = r.priority ?? 'medium'
    byPriority[p]++
    if (r.completed === 1) completedByPriority[p]++
  }
  const byRecurrence: Record<string, number> = {}
  for (const r of reminders) {
    byRecurrence[r.recurrence] = (byRecurrence[r.recurrence] ?? 0) + 1
  }
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
  return [
    `STATS: ${total} reminders | ${completed} completed (${completionRate}%) | ${overdue} overdue | ${inbox} inbox`,
    `BY PRIORITY: high ${byPriority.high} (done: ${completedByPriority.high}), medium ${byPriority.medium} (done: ${completedByPriority.medium}), low ${byPriority.low} (done: ${completedByPriority.low})`,
    `BY RECURRENCE: ${Object.entries(byRecurrence).map(([k, v]) => `${k}: ${v}`).join(', ')}`,
  ].join('\n')
}

export async function generateReminderInsight(
  reminders: Reminder[],
): Promise<ReminderInsight | null> {
  if (reminders.length < 5) return null

  const language = getAILanguage()
  const today = new Date()
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const summary = buildSummary(reminders)

  const prompt = `Analyze these reminder statistics and return a brief, helpful insight. Be specific and actionable.

Today: ${localDate}

${summary}

Return ONLY valid JSON:
{
  "pattern_summary": "<1-2 sentences about overall completion behavior>",
  "completion_insight": "<observation about what kinds of reminders get done vs. missed>",
  "overdue_insight": "<1 sentence about overdue patterns, or 'Great job staying on top of things!' if none>",
  "tip": "<one specific, actionable suggestion to improve reminder completion>"
}

Rules:
- Respond in ${language}
- Be warm, practical, and specific
- Never be judgmental`

  try {
    const raw = await chatCompletion(
      [
        {
          role: 'system',
          content: `You are a helpful productivity assistant. Reply in ${language} ONLY. Return ONLY valid JSON.`,
        },
        { role: 'user', content: prompt },
      ],
      { temperature: 0.4, max_tokens: 400 },
    )
    const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0]
    if (!jsonStr) return null
    return JSON.parse(jsonStr) as ReminderInsight
  } catch {
    return null
  }
}
