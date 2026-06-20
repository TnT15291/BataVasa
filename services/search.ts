import { getDb } from '@db/core/db'
import { getCurrentUserId } from '@services/identity'

export type SearchModule = 'finance' | 'reminders' | 'habits' | 'journals' | 'goals'

export type SearchResult = {
  id: string
  module: SearchModule
  title: string
  subtitle: string
  occurredAt: string | null
  route: string
  routeParams?: Record<string, string>
}

type SearchRow = {
  id: string
  title: string | null
  subtitle: string | null
  occurred_at: string | null
}

function likeTerm(query: string): string {
  return `%${query.trim().toLowerCase()}%`
}

async function searchFinance(term: string, limit: number): Promise<SearchResult[]> {
  const db = await getDb()
  const userId = getCurrentUserId()
  const rows = await db.getAllAsync<SearchRow>(
    `SELECT t.id,
            COALESCE(t.merchant, c.name, t.note, 'Transaction') AS title,
            COALESCE(t.note, c.name, t.currency) AS subtitle,
            t.occurred_at
     FROM finance_transaction t
     LEFT JOIN finance_category c ON c.id = t.category_id
     WHERE t.deleted_at IS NULL
       AND t.user_id = ?
       AND (
         lower(COALESCE(t.merchant, '')) LIKE ?
         OR lower(COALESCE(t.note, '')) LIKE ?
         OR lower(COALESCE(c.name, '')) LIKE ?
         OR CAST(ABS(t.amount_cents) AS TEXT) LIKE ?
       )
     ORDER BY t.occurred_at DESC
     LIMIT ?`,
    [userId, term, term, term, term, limit]
  )
  return rows.map((row) => ({
    id: row.id,
    module: 'finance',
    title: row.title ?? 'Transaction',
    subtitle: row.subtitle ?? '',
    occurredAt: row.occurred_at,
    route: '/new',
    routeParams: { id: row.id },
  }))
}

async function searchReminders(term: string, limit: number): Promise<SearchResult[]> {
  const db = await getDb()
  const userId = getCurrentUserId()
  const rows = await db.getAllAsync<SearchRow>(
    `SELECT id, title, note AS subtitle, remind_at AS occurred_at
     FROM reminder
     WHERE deleted_at IS NULL
       AND user_id = ?
       AND (lower(title) LIKE ? OR lower(COALESCE(note, '')) LIKE ?)
     ORDER BY COALESCE(remind_at, updated_at) DESC
     LIMIT ?`,
    [userId, term, term, limit]
  )
  return rows.map((row) => ({
    id: row.id,
    module: 'reminders',
    title: row.title ?? 'Task',
    subtitle: row.subtitle ?? '',
    occurredAt: row.occurred_at,
    route: '/reminder',
    routeParams: { id: row.id },
  }))
}

async function searchHabits(term: string, limit: number): Promise<SearchResult[]> {
  const db = await getDb()
  const userId = getCurrentUserId()
  const rows = await db.getAllAsync<SearchRow>(
    `SELECT id, name AS title, cadence AS subtitle, updated_at AS occurred_at
     FROM habit
     WHERE deleted_at IS NULL
       AND user_id = ?
       AND lower(name) LIKE ?
     ORDER BY updated_at DESC
     LIMIT ?`,
    [userId, term, limit]
  )
  return rows.map((row) => ({
    id: row.id,
    module: 'habits',
    title: row.title ?? 'Habit',
    subtitle: row.subtitle ?? '',
    occurredAt: row.occurred_at,
    route: '/habit',
    routeParams: { id: row.id },
  }))
}

async function searchJournals(term: string, limit: number): Promise<SearchResult[]> {
  const db = await getDb()
  const userId = getCurrentUserId()
  const rows = await db.getAllAsync<SearchRow>(
    `SELECT id,
            substr(content, 1, 80) AS title,
            COALESCE(tags, mood, '') AS subtitle,
            occurred_at
     FROM journal
     WHERE deleted_at IS NULL
       AND user_id = ?
       AND (
         lower(content) LIKE ?
         OR lower(COALESCE(mood, '')) LIKE ?
         OR lower(COALESCE(tags, '')) LIKE ?
       )
     ORDER BY occurred_at DESC
     LIMIT ?`,
    [userId, term, term, term, limit]
  )
  return rows.map((row) => ({
    id: row.id,
    module: 'journals',
    title: row.title ?? 'Journal',
    subtitle: row.subtitle ?? '',
    occurredAt: row.occurred_at,
    route: '/journal',
    routeParams: { id: row.id },
  }))
}

async function searchGoals(term: string, limit: number): Promise<SearchResult[]> {
  const db = await getDb()
  const userId = getCurrentUserId()
  const rows = await db.getAllAsync<SearchRow>(
    `SELECT id, title, COALESCE(description, status) AS subtitle, COALESCE(due_date, updated_at) AS occurred_at
     FROM goal
     WHERE deleted_at IS NULL
       AND user_id = ?
       AND (lower(title) LIKE ? OR lower(COALESCE(description, '')) LIKE ?)
     ORDER BY updated_at DESC
     LIMIT ?`,
    [userId, term, term, limit]
  )
  return rows.map((row) => ({
    id: row.id,
    module: 'goals',
    title: row.title ?? 'Goal',
    subtitle: row.subtitle ?? '',
    occurredAt: row.occurred_at,
    route: '/goal-detail',
    routeParams: { id: row.id },
  }))
}

export async function searchAll(query: string, limitPerModule = 8): Promise<SearchResult[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []
  const term = likeTerm(trimmed)
  const groups = await Promise.all([
    searchFinance(term, limitPerModule),
    searchReminders(term, limitPerModule),
    searchHabits(term, limitPerModule),
    searchJournals(term, limitPerModule),
    searchGoals(term, limitPerModule),
  ])
  return groups
    .flat()
    .sort((a, b) => (b.occurredAt ?? '').localeCompare(a.occurredAt ?? ''))
}
