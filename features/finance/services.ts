import { ok, appErr, type Result, type AppError } from '@services/result'
import { uuid } from '@services/uuid'
import { logger } from '@services/logger'
import { nowIso } from '@db/core/db'
import * as q from '@db/finance/queries'
import {
  CreateTransactionInputSchema,
  type CreateTransactionInput,
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
