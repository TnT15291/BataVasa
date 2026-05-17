import { ok, appErr, type Result, type AppError } from '@services/result'
import { uuid } from '@services/uuid'
import { logger } from '@services/logger'
import { nowIso } from '@db/core/db'
import * as q from '@db/finance/queries'
import {
  CreateTransactionInputSchema,
  UpdateTransactionInputSchema,
  type CreateTransactionInput,
  type UpdateTransactionInput,
  type Transaction,
  type Category,
} from './types'

const MODULE = 'finance.service'

export async function createTransaction(
  input: CreateTransactionInput
): Promise<Result<Transaction, AppError>> {
  const parsed = CreateTransactionInputSchema.safeParse(input)
  if (!parsed.success) {
    return appErr('VALIDATION_FAILED', parsed.error.issues[0]?.message ?? 'Invalid input', parsed.error)
  }
  const data = parsed.data

  try {
    const dup = await q.findDuplicateTransaction(data.amount_cents, data.merchant ?? null)
    if (dup) {
      logger.warn(MODULE, 'duplicate suspected', { existing_id: dup.id })
      return appErr('DUPLICATE', 'A very similar transaction was created in the last minute')
    }

    const now = nowIso()
    // Rule 6: if label is empty/missing, store NULL for all three columns
    const hasLocation = !!(data.location_label && data.location_label.trim().length > 0)
    const tx: Transaction = {
      id: uuid(),
      user_id: null,
      amount_cents: data.amount_cents,
      currency: data.currency,
      category_id: data.category_id,
      merchant: data.merchant ?? null,
      note: data.note ?? null,
      occurred_at: data.occurred_at,
      mood: data.mood ?? null,
      source: data.source,
      location_lat: hasLocation ? data.location_lat ?? null : null,
      location_lng: hasLocation ? data.location_lng ?? null : null,
      location_label: hasLocation ? data.location_label!.trim() : null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      synced_at: null,
    }
    await q.insertTransaction(tx)
    logger.info(MODULE, 'transaction created', { id: tx.id, source: tx.source })
    return ok(tx)
  } catch (e) {
    logger.error(MODULE, 'createTransaction failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to create transaction', e)
  }
}

export async function listTransactions(
  params?: q.ListTransactionsParams
): Promise<Result<Transaction[], AppError>> {
  try {
    const rows = await q.listTransactions(params)
    return ok(rows)
  } catch (e) {
    logger.error(MODULE, 'listTransactions failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to load transactions', e)
  }
}

export async function getTransaction(id: string): Promise<Result<Transaction, AppError>> {
  try {
    const row = await q.getTransaction(id)
    if (!row) return appErr('NOT_FOUND', 'Transaction not found')
    return ok(row)
  } catch (e) {
    logger.error(MODULE, 'getTransaction failed', { id, error: String(e) })
    return appErr('DB_ERROR', 'Failed to load transaction', e)
  }
}

export async function updateTransaction(
  input: UpdateTransactionInput
): Promise<Result<Transaction, AppError>> {
  const parsed = UpdateTransactionInputSchema.safeParse(input)
  if (!parsed.success) {
    return appErr('VALIDATION_FAILED', parsed.error.issues[0]?.message ?? 'Invalid input', parsed.error)
  }
  const data = parsed.data
  try {
    const existing = await q.getTransaction(data.id)
    if (!existing) return appErr('NOT_FOUND', 'Transaction not found')

    // Build patch — only fields user actually changed; respect Rule 6 location clearing
    const patch: Partial<Transaction> = { updated_at: nowIso() }
    if (data.amount_cents !== undefined) patch.amount_cents = data.amount_cents
    if (data.currency !== undefined) patch.currency = data.currency
    if (data.category_id !== undefined) patch.category_id = data.category_id
    if (data.merchant !== undefined) patch.merchant = data.merchant || null
    if (data.note !== undefined) patch.note = data.note || null
    if (data.occurred_at !== undefined) patch.occurred_at = data.occurred_at
    if (data.mood !== undefined) patch.mood = data.mood ?? null
    if (data.source !== undefined) patch.source = data.source
    if ('location_label' in data) {
      const hasLocation = !!(data.location_label && data.location_label.trim().length > 0)
      patch.location_lat = hasLocation ? data.location_lat ?? null : null
      patch.location_lng = hasLocation ? data.location_lng ?? null : null
      patch.location_label = hasLocation ? data.location_label!.trim() : null
    }

    await q.updateTransaction(data.id, patch)
    logger.info(MODULE, 'transaction updated', { id: data.id })
    const fresh = await q.getTransaction(data.id)
    if (!fresh) return appErr('INTERNAL', 'Updated row vanished')
    return ok(fresh)
  } catch (e) {
    logger.error(MODULE, 'updateTransaction failed', { id: data.id, error: String(e) })
    return appErr('DB_ERROR', 'Failed to update transaction', e)
  }
}

export async function deleteTransaction(id: string): Promise<Result<void, AppError>> {
  try {
    const existing = await q.getTransaction(id)
    if (!existing) return appErr('NOT_FOUND', 'Transaction not found')
    await q.softDeleteTransaction(id, nowIso())
    logger.info(MODULE, 'transaction deleted', { id })
    return ok(undefined)
  } catch (e) {
    logger.error(MODULE, 'deleteTransaction failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to delete transaction', e)
  }
}

export async function listCategories(): Promise<Result<Category[], AppError>> {
  try {
    const rows = await q.listCategories()
    return ok(rows)
  } catch (e) {
    logger.error(MODULE, 'listCategories failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to load categories', e)
  }
}

// Cross-Module Rule 1: hard-delete all finance data for current user.
// TODO when sync engine is built: also queue tombstone op to Supabase.
export async function wipeAllData(): Promise<Result<{ deleted: number }, AppError>> {
  try {
    const { transactions, categories } = await q.wipeFinanceData()
    const total = transactions + categories
    logger.info(MODULE, 'wipeAllData succeeded', { count: total })
    return ok({ deleted: total })
  } catch (e) {
    logger.error(MODULE, 'wipeAllData failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to wipe finance data', e)
  }
}

export function isExpense(tx: Pick<Transaction, 'amount_cents'>): boolean {
  return tx.amount_cents < 0
}

export function formatAmount(cents: number, currency = 'VND'): string {
  const abs = Math.abs(cents)
  if (currency === 'VND') {
    return new Intl.NumberFormat('vi-VN').format(abs) + ' ₫'
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(abs / 100)
}
