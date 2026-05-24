import { getDb } from '../core/db'
import type { Category, Transaction, TransactionRule } from '@features/finance/types'

type CategoryRow = Category
type TransactionRow = Transaction
type TransactionRuleRow = TransactionRule

export async function insertTransaction(row: TransactionRow): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    `INSERT INTO finance_transaction
     (id, user_id, amount_cents, currency, category_id, merchant, note, occurred_at, mood, source, needs_review, review_reason, location_lat, location_lng, location_label, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      row.needs_review ?? 0,
      row.review_reason ?? null,
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

export async function getTransaction(id: string, userId: string | null): Promise<TransactionRow | null> {
  const db = await getDb()
  const row = await db.getFirstAsync<TransactionRow>(
    'SELECT * FROM finance_transaction WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
    [id, userId]
  )
  return row ?? null
}

export type ListTransactionsParams = {
  from?: string
  to?: string
  categoryId?: string
  needsReview?: boolean
  limit?: number
  offset?: number
}

export async function listTransactions(userId: string | null, params: ListTransactionsParams = {}): Promise<TransactionRow[]> {
  const db = await getDb()
  const where: string[] = ['deleted_at IS NULL', 'user_id = ?']
  const args: (string | number | null)[] = [userId]
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
  if (params.needsReview !== undefined) {
    where.push('COALESCE(needs_review, 0) = ?')
    args.push(params.needsReview ? 1 : 0)
  }
  const limit = params.limit ?? 100
  const offset = params.offset ?? 0
  const sql = `SELECT * FROM finance_transaction WHERE ${where.join(' AND ')} ORDER BY occurred_at DESC LIMIT ? OFFSET ?`
  return db.getAllAsync<TransactionRow>(sql, [...args, limit, offset])
}

export async function upsertTransactionRule(row: TransactionRuleRow): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    `INSERT INTO finance_rule
     (id, user_id, merchant_pattern, category_id, created_at, updated_at, deleted_at, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       user_id = excluded.user_id,
       merchant_pattern = excluded.merchant_pattern,
       category_id = excluded.category_id,
       updated_at = excluded.updated_at,
       deleted_at = excluded.deleted_at,
       synced_at = excluded.synced_at`,
    [row.id, row.user_id, row.merchant_pattern, row.category_id, row.created_at, row.updated_at, row.deleted_at, row.synced_at]
  )
}

export async function findRuleForMerchant(merchant: string | null, userId: string | null): Promise<TransactionRuleRow | null> {
  if (!merchant?.trim()) return null
  const db = await getDb()
  const normalized = merchant.trim().toLowerCase()
  const row = await db.getFirstAsync<TransactionRuleRow>(
    `SELECT * FROM finance_rule
     WHERE deleted_at IS NULL
       AND user_id = ?
       AND (
         lower(?) = lower(merchant_pattern)
         OR lower(?) LIKE '%' || lower(merchant_pattern) || '%'
       )
     ORDER BY length(merchant_pattern) DESC, updated_at DESC
     LIMIT 1`,
    [userId, normalized, normalized]
  )
  return row ?? null
}

export async function findRuleByPattern(pattern: string, userId: string | null): Promise<TransactionRuleRow | null> {
  const db = await getDb()
  const row = await db.getFirstAsync<TransactionRuleRow>(
    `SELECT * FROM finance_rule
     WHERE lower(merchant_pattern) = lower(?)
       AND user_id = ?
       AND deleted_at IS NULL
     LIMIT 1`,
    [pattern.trim().toLowerCase(), userId]
  )
  return row ?? null
}

export async function listTransactionRules(userId: string | null): Promise<TransactionRuleRow[]> {
  const db = await getDb()
  return db.getAllAsync<TransactionRuleRow>(
    `SELECT * FROM finance_rule
     WHERE deleted_at IS NULL
       AND user_id = ?
     ORDER BY updated_at DESC`,
    [userId]
  )
}

export async function findDuplicateTransaction(
  amountCents: number,
  merchant: string | null,
  userId: string | null,
  withinMs = 60_000
): Promise<TransactionRow | null> {
  const db = await getDb()
  const since = new Date(Date.now() - withinMs).toISOString()
  const row = await db.getFirstAsync<TransactionRow>(
    `SELECT * FROM finance_transaction
     WHERE amount_cents = ?
       AND user_id = ?
       AND (merchant IS ? OR merchant = ?)
       AND created_at >= ?
       AND deleted_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [amountCents, userId, merchant, merchant ?? '', since]
  )
  return row ?? null
}

// Hard-delete all finance data for the current user (Cross-Module Rule 1).
// Wipes: all transactions + user-created categories. System categories stay
// (they're seeded data, will re-show on next launch).
// Returns count of deleted rows for confirmation toast.
export async function wipeFinanceData(userId: string | null): Promise<{ transactions: number; categories: number; rules: number }> {
  const db = await getDb()
  const txCount = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM finance_transaction WHERE user_id = ?',
    [userId]
  )
  const catCount = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM finance_category WHERE user_id = ?',
    [userId]
  )
  const ruleCount = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM finance_rule WHERE user_id = ?',
    [userId]
  )
  await db.runAsync('DELETE FROM finance_transaction WHERE user_id = ?', [userId])
  await db.runAsync('DELETE FROM finance_rule WHERE user_id = ?', [userId])
  await db.runAsync('DELETE FROM finance_category WHERE user_id = ?', [userId])
  return {
    transactions: txCount?.n ?? 0,
    categories: catCount?.n ?? 0,
    rules: ruleCount?.n ?? 0,
  }
}

// System categories (user_id IS NULL) are shared seed data visible to everyone;
// user-created categories are scoped to the owner.
export async function listCategories(userId: string | null): Promise<CategoryRow[]> {
  const db = await getDb()
  return db.getAllAsync<CategoryRow>(
    `SELECT * FROM finance_category
     WHERE deleted_at IS NULL
       AND (user_id IS NULL OR user_id = ?)
     ORDER BY kind, sort_order, name`,
    [userId]
  )
}

export async function getCategory(id: string, userId: string | null): Promise<CategoryRow | null> {
  const db = await getDb()
  const row = await db.getFirstAsync<CategoryRow>(
    'SELECT * FROM finance_category WHERE id = ? AND deleted_at IS NULL AND (user_id IS NULL OR user_id = ?)',
    [id, userId]
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

export async function exportFinanceData(userId: string | null): Promise<{ transactions: TransactionRow[]; categories: CategoryRow[]; rules: TransactionRuleRow[] }> {
  const db = await getDb()
  const transactions = await db.getAllAsync<TransactionRow>(
    'SELECT * FROM finance_transaction WHERE deleted_at IS NULL AND user_id = ? ORDER BY occurred_at DESC',
    [userId]
  )
  const categories = await db.getAllAsync<CategoryRow>(
    'SELECT * FROM finance_category WHERE deleted_at IS NULL AND (user_id IS NULL OR user_id = ?) ORDER BY kind, sort_order',
    [userId]
  )
  const rules = await db.getAllAsync<TransactionRuleRow>(
    'SELECT * FROM finance_rule WHERE deleted_at IS NULL AND user_id = ? ORDER BY updated_at DESC',
    [userId]
  )
  return { transactions, categories, rules }
}
