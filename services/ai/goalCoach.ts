import { chatCompletion } from './openai'
import { getAILanguage, getAICurrency, fmtAI } from './aiLanguage'
import { getDb } from '@db/core/db'
import { getCurrentUserId } from '@services/identity'
import { listHabits } from '@db/habits/queries'
import { listJournals } from '@db/journals/queries'
import { listReminders } from '@db/reminders/queries'
import { listCategories } from '@db/finance/queries'
import type { GoalWithProgress } from '@features/goals/types'

// ── Structured plan the coach returns ───────────────────────────────────────

export type CoachHabit = {
  title: string
  cadence: 'daily' | 'weekdays' | 'custom'
  target_per_period: number
  why: string
}

export type CoachTask = {
  title: string
  remind_at: string // normalized ISO, always future
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly'
  why: string
}

export type CoachJournalDraft = {
  content: string
  mood: number
  tags: string
}

export type GoalCoachPlan = {
  summary: string
  habits: CoachHabit[]
  tasks: CoachTask[]
  spendingAdvice: string[]
  journalDraft: CoachJournalDraft | null
}

// ── Helpers (mirrors universalEntry deterministic normalization) ────────────

function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value)
  if (!isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n)))
}

function tomorrowAt9(now: Date): Date {
  const d = new Date(now)
  d.setDate(d.getDate() + 1)
  d.setHours(9, 0, 0, 0)
  return d
}

// Never trust AI dates: accept only a valid, future ISO; otherwise fall back.
function normalizeRemindAt(raw: unknown, now: Date): string {
  if (typeof raw === 'string' && raw.trim()) {
    const d = new Date(raw)
    if (!isNaN(d.getTime()) && d > now) return d.toISOString()
  }
  return tomorrowAt9(now).toISOString()
}

function extractJson(raw: string): any | null {
  const objectStart = raw.indexOf('{')
  if (objectStart < 0) return null
  const end = raw.lastIndexOf('}')
  if (end <= objectStart) return null
  try {
    return JSON.parse(raw.slice(objectStart, end + 1))
  } catch {
    return null
  }
}

// ── Context: compact cross-module summary for the prompt ────────────────────

const HORIZON_DAYS = 90

export async function buildGoalCoachContext(goal: GoalWithProgress): Promise<string> {
  const userId = getCurrentUserId()
  const currency = getAICurrency()
  const since = new Date(Date.now() - HORIZON_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const [categories, habits, journals, reminders] = await Promise.all([
    listCategories(userId),
    listHabits(userId),
    listJournals(userId),
    listReminders(userId),
  ])

  // Finance: spend per category over the horizon.
  const db = await getDb()
  const spendRows = await db.getAllAsync<{ category_id: string; total: number | null }>(
    `SELECT category_id, COALESCE(SUM(ABS(amount_cents)), 0) AS total
       FROM finance_transaction
      WHERE deleted_at IS NULL AND user_id = ? AND amount_cents < 0 AND occurred_at >= ?
      GROUP BY category_id
      ORDER BY total DESC
      LIMIT 6`,
    [userId, since]
  )
  const catName = new Map(categories.map((c) => [c.id, c.name]))
  const topSpend = spendRows
    .map((r) => `  ${catName.get(r.category_id) ?? 'Other'}: ${fmtAI(r.total ?? 0, currency)}`)
    .join('\n') || '  (no spending recorded)'

  const habitNames = habits.map((h) => h.name)
  const habitList = habitNames.length > 0 ? habitNames.map((n) => `  ${n}`).join('\n') : '  (none yet)'

  const recentJournals = journals.filter((j) => !j.deleted_at && j.occurred_at >= since)
  const tagCounts = new Map<string, number>()
  const moods: number[] = []
  for (const j of recentJournals) {
    if (typeof j.mood === 'number') moods.push(j.mood)
    for (const raw of (j.tags ?? '').split(',')) {
      const tag = raw.trim()
      if (tag) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }
  const topTags = Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t).join(', ') || '(none)'
  const avgMood = moods.length > 0 ? (moods.reduce((s, m) => s + m, 0) / moods.length).toFixed(1) : 'n/a'

  const openTasks = reminders.filter((r) => !r.deleted_at && r.is_inbox !== 1 && r.completed !== 1).length

  const source = goal.binding
    ? `${goal.binding.module} (${goal.progress.sourceLabel || goal.binding.module})`
    : 'unbound'

  return `GOAL
  Title: ${goal.title}${goal.description ? `\n  Note: ${goal.description}` : ''}
  Progress: ${goal.progress.label} (${goal.progress.percent}%)
  Tracked from: ${source}

FINANCE (last ${HORIZON_DAYS}d, top spend categories):
${topSpend}

EXISTING HABITS (do NOT suggest duplicates of these):
${habitList}

JOURNALS (last ${HORIZON_DAYS}d): ${recentJournals.length} entries, avg mood ${avgMood}, frequent tags: ${topTags}

TASKS: ${openTasks} open`
}

// ── Generation ──────────────────────────────────────────────────────────────

export async function generateGoalCoachPlan(goal: GoalWithProgress): Promise<GoalCoachPlan | null> {
  const language = getAILanguage()
  const now = new Date()

  let context: string
  try {
    context = await buildGoalCoachContext(goal)
  } catch {
    return null
  }

  // If the goal is tracked by journal entries in a specific area, the draft
  // MUST use that area's tag so writing it actually advances the goal.
  const journalFocus = goal.binding?.module === 'journals' && goal.binding.tag !== 'all'
    ? goal.binding.tag
    : null

  const prompt = `You are BataVasa's goal coach. Based on the user's goal and their real past data across four modules (Finance, Habits, Journals, Reminders), propose a concrete, achievable action plan to reach the goal while covering basic needs and saving.

${context}

Return ONLY valid JSON in this exact shape (no markdown, no commentary):
{
  "summary": "<one short sentence framing the plan>",
  "habits": [{"title":"<habit name>","cadence":"daily|weekdays|custom","target_per_period":<int 1-10>,"why":"<short reason tied to the goal>"}],
  "tasks": [{"title":"<actionable task, e.g. open a piggy bank / practice coding 30 min>","when":"<ISO datetime in the future or null>","recurrence":"none|daily|weekly|monthly","why":"<short reason>"}],
  "spendingAdvice": ["<short actionable money tip balancing needs and saving toward the goal>"],
  "journalDraft": {"content":"<a short first-person journal entry reflecting on recent activity and what was done toward this goal>","mood":<int 1-5>,"tags":"<comma-separated from: work,family,health,money,sleep,exercise,stress,food,travel,social>"}
}

Rules:
- Reply entirely in ${language}. Every title, why, advice line, and the journal content MUST be in ${language}.
- Suggest 1-3 habits, 1-3 tasks, 2-4 spending tips. Never duplicate an existing habit listed above.
- Habits must be realistic and directly serve the goal.
- For journalDraft: pick the SINGLE life area most relevant to this goal as "tags", and make the content reflect on that area in relation to the goal, so journaling about it directly supports progress.${journalFocus ? `\n- This goal counts journal entries tagged "${journalFocus}", so journalDraft.tags MUST be "${journalFocus}".` : ''}
- Keep each text short and specific; reference the user's real situation.
- Current datetime is ${now.toISOString()}.`

  let raw: string
  try {
    raw = await chatCompletion(
      [
        { role: 'system', content: `You are a JSON-only goal coach. The user reads ${language}. Return ONLY valid JSON, nothing else.` },
        { role: 'user', content: prompt },
      ],
      { temperature: 0.4, max_tokens: 900 }
    )
  } catch {
    return null
  }

  const parsed = extractJson(raw)
  if (!parsed) return null

  const existingHabits = new Set(
    (await listHabits(getCurrentUserId()).catch(() => [])).map((h) => foldText(h.name))
  )

  const habits: CoachHabit[] = Array.isArray(parsed.habits)
    ? parsed.habits
        .map((h: any): CoachHabit | null => {
          const title = String(h?.title ?? '').trim()
          if (!title) return null
          if (existingHabits.has(foldText(title))) return null
          const cadence = ['daily', 'weekdays', 'custom'].includes(h?.cadence) ? h.cadence : 'daily'
          return { title, cadence, target_per_period: clampInt(h?.target_per_period, 1, 10, 1), why: String(h?.why ?? '').trim() }
        })
        .filter((h: CoachHabit | null): h is CoachHabit => h !== null)
        .slice(0, 4)
    : []

  const tasks: CoachTask[] = Array.isArray(parsed.tasks)
    ? parsed.tasks
        .map((t: any): CoachTask | null => {
          const title = String(t?.title ?? '').trim()
          if (!title) return null
          const recurrence = ['none', 'daily', 'weekly', 'monthly'].includes(t?.recurrence) ? t.recurrence : 'none'
          return { title, remind_at: normalizeRemindAt(t?.when, now), recurrence, why: String(t?.why ?? '').trim() }
        })
        .filter((t: CoachTask | null): t is CoachTask => t !== null)
        .slice(0, 4)
    : []

  const spendingAdvice: string[] = Array.isArray(parsed.spendingAdvice)
    ? parsed.spendingAdvice.map((s: any) => String(s ?? '').trim()).filter((s: string) => s.length > 0).slice(0, 5)
    : []

  let journalDraft: CoachJournalDraft | null = null
  if (parsed.journalDraft && String(parsed.journalDraft.content ?? '').trim()) {
    journalDraft = {
      content: String(parsed.journalDraft.content).trim(),
      mood: clampInt(parsed.journalDraft.mood, 1, 5, 4),
      tags: String(parsed.journalDraft.tags ?? '').trim(),
    }
  }

  return {
    summary: String(parsed.summary ?? '').trim(),
    habits,
    tasks,
    spendingAdvice,
    journalDraft,
  }
}
