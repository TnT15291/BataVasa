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

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function localDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function isDueOnDay(habit: Pick<Habit, 'cadence' | 'schedule_days'>, day: number): boolean {
  if (habit.cadence === 'weekdays') return day >= 1 && day <= 5
  if (habit.cadence === 'custom') {
    const days = (habit.schedule_days ?? '').split(',').map(Number).filter((n) => n >= 0 && n <= 6)
    return days.length === 0 ? true : days.includes(day)
  }
  return true
}

function buildHabitStats(habits: Habit[], logs: HabitLog[], periodDays: number): string {
  const today = new Date()
  today.setHours(23, 59, 59, 999)

  const lines: string[] = []

  for (const habit of habits) {
    const habitLogs = logs.filter((l) => l.habit_id === habit.id)
    const completedLogs = habitLogs.filter((l) => !l.skipped)
    const skippedLogs = habitLogs.filter((l) => l.skipped)

    // Date sets
    const completedDates = new Set(completedLogs.map((l) => l.occurred_at.split('T')[0]))
    const skippedDates = new Set(skippedLogs.map((l) => l.occurred_at.split('T')[0]))

    // Count days due in the period
    let dueCount = 0
    for (let i = 0; i < periodDays; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      if (isDueOnDay(habit, d.getDay())) dueCount++
    }
    // For weekly/monthly habits, use log count as proxy
    const effectiveDue = habit.cadence === 'weekly' ? Math.floor(periodDays / 7)
      : habit.cadence === 'monthly' ? 1
      : dueCount

    const completionPct = effectiveDue > 0 ? Math.round((completedDates.size / effectiveDue) * 100) : 0

    // Streak (consecutive completed days working backwards, skips don't break it)
    let streak = 0
    const cur = new Date(today)
    for (let i = 0; i < 365; i++) {
      const ds = localDateStr(cur)
      if (!isDueOnDay(habit, cur.getDay())) {
        cur.setDate(cur.getDate() - 1)
        continue
      }
      if (completedDates.has(ds)) { streak++; cur.setDate(cur.getDate() - 1) }
      else if (skippedDates.has(ds)) { cur.setDate(cur.getDate() - 1) }
      else break
    }

    // Last 14 days mini-timeline
    const last14: string[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const ds = localDateStr(d)
      if (!isDueOnDay(habit, d.getDay())) last14.push('-')
      else if (completedDates.has(ds)) last14.push('✓')
      else if (skippedDates.has(ds)) last14.push('S')
      else last14.push('✗')
    }

    // Day-of-week completion rate (for daily/weekday habits only)
    let dowPattern = ''
    if (habit.cadence === 'daily' || habit.cadence === 'weekdays') {
      const dowDone = new Array(7).fill(0) as number[]
      const dowDue = new Array(7).fill(0) as number[]
      for (let i = 0; i < periodDays; i++) {
        const d = new Date(today)
        d.setDate(today.getDate() - i)
        const day = d.getDay()
        if (!isDueOnDay(habit, day)) continue
        dowDue[day]++
        if (completedDates.has(localDateStr(d))) dowDone[day]++
      }
      dowPattern = DAY_NAMES
        .map((name, day) => dowDue[day]! > 0 ? `${name}:${dowDone[day]}/${dowDue[day]}` : null)
        .filter(Boolean)
        .join(' ')
    }

    // First half vs second half trend
    const firstHalfDone = Array.from(completedDates).filter((ds) => {
      const d = new Date(ds)
      return d < new Date(today.getTime() - (periodDays / 2) * 86400000)
    }).length
    const secondHalfDone = completedDates.size - firstHalfDone
    const trend = secondHalfDone > firstHalfDone ? '↑ improving'
      : secondHalfDone < firstHalfDone ? '↓ declining'
      : '→ steady'

    lines.push(
      `[${habit.icon} ${habit.name}] cadence:${habit.cadence} | completion:${completedDates.size}/${effectiveDue} (${completionPct}%) | streak:${streak}d | skipped:${skippedDates.size} | trend:${trend}`,
      `  Last 14 days (oldest→newest): ${last14.join(' ')}`,
      dowPattern ? `  Day pattern: ${dowPattern}` : '',
    )
  }

  return lines.filter(Boolean).join('\n')
}

export async function generateHabitInsight(
  habits: Habit[],
  logs: HabitLog[],
  period = 'last 30 days',
  periodDays = 30,
): Promise<HabitInsight | null> {
  if (habits.length === 0 || logs.length < 3) return null

  const language = getAILanguage()
  const today = new Date()
  const localDate = localDateStr(today)
  const stats = buildHabitStats(habits, logs, periodDays)

  const prompt = `Analyze these habits and return a JSON insight. Be specific — reference actual habit names, completion rates, and day patterns from the data.

Today: ${localDate}
Period: ${period}

${stats}

Legend: ✓=done  ✗=missed  S=skipped  -=not scheduled

Return ONLY valid JSON:
{
  "consistency_summary": "<1-2 sentences about overall pattern, reference specific % and trends>",
  "strongest_habit": "<habit name + specific rate + what makes it strong>",
  "needs_attention": "<habit name + specific miss pattern, e.g. which days, or 'all on track' if none>",
  "encouragement": "<1 warm sentence referencing the user's actual progress>",
  "tip": "<1 specific actionable tip for the weakest habit, tied to its miss pattern>"
}

Rules:
- Respond in ${language}
- Be specific: quote completion percentages and day names
- Never leave a field empty or null`

  try {
    const raw = await chatCompletion(
      [
        {
          role: 'system',
          content: `You are a supportive habit coach. Reply in ${language} ONLY. Return ONLY valid JSON, no explanation outside the JSON.`,
        },
        { role: 'user', content: prompt },
      ],
      { temperature: 0.4, max_tokens: 450 },
    )
    const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0]
    if (!jsonStr) return null
    return JSON.parse(jsonStr) as HabitInsight
  } catch {
    return null
  }
}
