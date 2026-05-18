import { getDb } from '../core/db'
import type { Category, Transaction } from '@features/finance/types'

type CategoryRow = Category
type TransactionRow = Transaction

export async function insertTransaction(row: TransactionRow): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    `INSERT INTO finance_transaction
     (id, user_id, amount_cents, currency, category_id, merchant, note, occurred_at, mood, source, location_lat, location_lng, location_label, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.user_id,
      row.amount_cents,
      row.currency,
      row.category_id,
      row.merchant,
      row.note,
      row.occurred_at,
      row.mood,
      row.source,
      row.location_lat,
      row.location_lng,
      row.location_label,
      row.created_at,
      row.updated_at,
    ]
  )
}

export async function updateTransaction(id: string, patch: Partial<TransactionRow>): Promise<void> {
  const db = await getDb()
  const cols: string[] = []
  const vals: (string | number | null)[] = []
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'id') continue
    cols.push(`${k} = ?`)
    vals.push(v as string | number | null)
  }
  if (cols.length === 0) return
  vals.push(id)
  await db.runAsync(`UPDATE finance_transaction SET ${cols.join(', ')} WHERE id = ?`, vals)
}

export async function softDeleteTransaction(id: string, deletedAt: string): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    'UPDATE finance_transaction SET deleted_at = ?, updated_at = ? WHERE id = ?',
    [deletedAt, deletedAt, id]
  )
}

export async function getTransaction(id: string): Promise<TransactionRow | null> {
  const db = await getDb()
  const row = await db.getFirstAsync<TransactionRow>(
    'SELECT * FROM finance_transaction WHERE id = ? AND deleted_at IS NULL',
    [id]
  )
  return row ?? null
}

export type ListTransactionsParams = {
  from?: string
  to?: string
  categoryId?: string
  limit?: number
  offset?: number
}

export async function listTransactions(params: ListTransactionsParams = {}): Promise<TransactionRow[]> {
  const db = await getDb()
  const where: string[] = ['deleted_at IS NULL']
  const args: (string | number)[] = []
  if (params.from) {
    where.push('occurred_at >= ?')
    args.push(params.from)
  }
  if (params.to) {
    where.push('occurred_at <= ?')
    args.push(params.to)
  }
  if (params.categoryId) {
    where.push('category_id = ?')
    args.push(params.categoryId)
  }
  const limit = params.limit ?? 100
  const offset = params.offset ?? 0
  const sql = `SELECT * FROM finance_transaction WHERE ${where.join(' AND ')} ORDER BY occurred_at DESC LIMIT ? OFFSET ?`
  return db.getAllAsync<TransactionRow>(sql, [...args, limit, offset])
}

export async function findDuplicateTransaction(
  amountCents: number,
  merchant: string | null,
  withinMs = 60_000
): Promise<TransactionRow | null> {
  const db = await getDb()
  const since = new Date(Date.now() - withinMs).toISOString()
  const row = await db.getFirstAsync<TransactionRow>(
    `SELECT * FROM finance_transaction
     WHERE amount_cents = ?
       AND (merchant IS ? OR merchant = ?)
       AND created_at >= ?
       AND deleted_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [amountCents, merchant, merchant ?? '', since]
  )
  return row ?? null
}

// Hard-delete all finance data for the current user (Cross-Module Rule 1).
// Wipes: all transactions + user-created categories. System categories stay
// (they're seeded data, will re-show on next launch).
// Returns count of deleted rows for confirmation toast.
export async function wipeFinanceData(): Promise<{ transactions: number; categories: number }> {
  const db = await getDb()
  const txCount = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM finance_transaction'
  )
  const catCount = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM finance_category WHERE user_id IS NOT NULL'
  )
  await db.execAsync('DELETE FROM finance_transaction')
  await db.execAsync('DELETE FROM finance_category WHERE user_id IS NOT NULL')
  return {
    transactions: txCount?.n ?? 0,
    categories: catCount?.n ?? 0,
  }
}

export async function listCategories(): Promise<CategoryRow[]> {
  const db = await getDb()
  return db.getAllAsync<CategoryRow>(
    `SELECT * FROM finance_category
     WHERE deleted_at IS NULL
     ORDER BY kind, sort_order, name`
  )
}

export async function getCategory(id: string): Promise<CategoryRow | null> {
  const db = await getDb()
  const row = await db.getFirstAsync<CategoryRow>(
    'SELECT * FROM finance_category WHERE id = ? AND deleted_at IS NULL',
    [id]
  )
  return row ?? null
}

export async function insertCategory(row: CategoryRow): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    `INSERT INTO finance_category
     (id, user_id, name, icon, color, kind, parent_id, sort_order, monthly_budget_cents, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id, row.user_id, row.name, row.icon, row.color,
      row.kind, row.parent_id, row.sort_order,
      row.monthly_budget_cents, row.created_at, row.updated_at,
    ]
  )
}

export async function updateCategory(id: string, patch: Partial<CategoryRow>): Promise<void> {
  const db = await getDb()
  const cols: string[] = []
  const vals: (string | number | null)[] = []
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'id') continue
    cols.push(`${k} = ?`)
    vals.push(v as string | number | null)
  }
  if (cols.length === 0) return
  vals.push(id)
  await db.runAsync(`UPDATE finance_category SET ${cols.join(', ')} WHERE id = ?`, vals)
}

export async function softDeleteCategory(id: string, deletedAt: string): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    'UPDATE finance_category SET deleted_at = ?, updated_at = ? WHERE id = ?',
    [deletedAt, deletedAt, id]
  )
}

export async function exportFinanceData(): Promise<{ transactions: TransactionRow[]; categories: CategoryRow[] }> {
  const db = await getDb()
  const transactions = await db.getAllAsync<TransactionRow>(
    'SELECT * FROM finance_transaction WHERE deleted_at IS NULL ORDER BY occurred_at DESC'
  )
  const categories = await db.getAllAsync<CategoryRow>(
    'SELECT * FROM finance_category WHERE deleted_at IS NULL ORDER BY kind, sort_order'
  )
  return { transactions, categories }
}
