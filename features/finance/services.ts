import { ok, appErr, type Result, type AppError } from '@services/result'
import { uuid } from '@services/uuid'
import { logger } from '@services/logger'
import { getCurrentUserId } from '@services/identity'
import { nowIso } from '@db/core/db'
import * as q from '@db/finance/queries'
import { enqueue } from '@db/sync/queue'
import { track } from '@services/analytics'
import {
  CreateTransactionInputSchema,
  UpdateTransactionInputSchema,
  CreateCategoryInputSchema,
  UpdateCategoryInputSchema,
  type CreateTransactionInput,
  type UpdateTransactionInput,
  type CreateCategoryInput,
  type UpdateCategoryInput,
  type Transaction,
  type TransactionRule,
  type Category,
} from './types'

const MODULE = 'finance.service'

function normalizeMerchantPattern(merchant: string | null | undefined): string | null {
  const pattern = merchant?.trim().toLowerCase().replace(/\s+/g, ' ')
  return pattern && pattern.length >= 2 ? pattern.slice(0, 120) : null
}

async function learnMerchantRule(merchant: string | null | undefined, categoryId: string): Promise<TransactionRule | null> {
  const merchantPattern = normalizeMerchantPattern(merchant)
  if (!merchantPattern) return null
  const now = nowIso()
  const existing = await q.findRuleByPattern(merchantPattern, getCurrentUserId())
  const rule: TransactionRule = {
    id: existing?.id ?? uuid(),
    user_id: getCurrentUserId(),
    merchant_pattern: merchantPattern,
    category_id: categoryId,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    deleted_at: null,
    synced_at: null,
  }
  await q.upsertTransactionRule(rule)
  void enqueue('finance_rule', rule.id, 'upsert')
  return rule
}

export async function createTransaction(
  input: CreateTransactionInput
): Promise<Result<Transaction, AppError>> {
  const parsed = CreateTransactionInputSchema.safeParse(input)
  if (!parsed.success) {
    return appErr('VALIDATION_FAILED', parsed.error.issues[0]?.message ?? 'Invalid input', parsed.error)
  }
  const data = parsed.data

  try {
    const dup = await q.findDuplicateTransaction(data.amount_cents, data.merchant ?? null, getCurrentUserId())
    if (dup) {
      logger.warn(MODULE, 'duplicate suspected', { existing_id: dup.id })
      return appErr('DUPLICATE', 'A very similar transaction was created in the last minute')
    }

    const now = nowIso()
    // Rule 6: if label is empty/missing, store NULL for all three columns
    const hasLocation = !!(data.location_label && data.location_label.trim().length > 0)
    const merchantRule = data.source !== 'manual' ? await q.findRuleForMerchant(data.merchant ?? null, getCurrentUserId()) : null
    const categoryId = merchantRule?.category_id ?? data.category_id
    const defaultNeedsReview = data.source === 'voice' || data.source === 'ocr' || data.source === 'import' ? 1 : 0
    const defaultReviewReason = data.source === 'voice' ? 'voice_entry' : data.source === 'ocr' ? 'ocr_entry' : data.source === 'import' ? 'imported_entry' : null
    const tx: Transaction = {
      id: uuid(),
      user_id: getCurrentUserId(),
      amount_cents: data.amount_cents,
      currency: data.currency,
      category_id: categoryId,
      merchant: data.merchant ?? null,
      note: data.note ?? null,
      occurred_at: data.occurred_at,
      mood: data.mood ?? null,
      source: data.source,
      needs_review: merchantRule ? 0 : data.needs_review ?? defaultNeedsReview,
      review_reason: merchantRule ? null : data.review_reason ?? defaultReviewReason,
      location_lat: hasLocation ? data.location_lat ?? null : null,
      location_lng: hasLocation ? data.location_lng ?? null : null,
      location_label: hasLocation ? data.location_label!.trim() : null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      synced_at: null,
    }
    await q.insertTransaction(tx)
    void enqueue('finance_transaction', tx.id, 'upsert')
    if (tx.source === 'manual' && tx.merchant) {
      try {
        await learnMerchantRule(tx.merchant, tx.category_id)
      } catch (ruleError) {
        logger.warn(MODULE, 'learn rule failed', { id: tx.id, error: String(ruleError) })
      }
    }
    track('transaction_created', { category_kind: data.amount_cents >= 0 ? 'income' : undefined, source: data.source })
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
    const rows = await q.listTransactions(getCurrentUserId(), params)
    return ok(rows)
  } catch (e) {
    logger.error(MODULE, 'listTransactions failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to load transactions', e)
  }
}

export async function getTransaction(id: string): Promise<Result<Transaction, AppError>> {
  try {
    const row = await q.getTransaction(id, getCurrentUserId())
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
    const existing = await q.getTransaction(data.id, getCurrentUserId())
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
    if (data.needs_review !== undefined) patch.needs_review = data.needs_review
    if (data.review_reason !== undefined) patch.review_reason = data.review_reason || null
    if ('location_label' in data) {
      const hasLocation = !!(data.location_label && data.location_label.trim().length > 0)
      patch.location_lat = hasLocation ? data.location_lat ?? null : null
      patch.location_lng = hasLocation ? data.location_lng ?? null : null
      patch.location_label = hasLocation ? data.location_label!.trim() : null
    }

    await q.updateTransaction(data.id, patch)
    void enqueue('finance_transaction', data.id, 'upsert')
    logger.info(MODULE, 'transaction updated', { id: data.id })
    const fresh = await q.getTransaction(data.id, getCurrentUserId())
    if (!fresh) return appErr('INTERNAL', 'Updated row vanished')
    if (fresh.needs_review === 0 && fresh.merchant) {
      try {
        await learnMerchantRule(fresh.merchant, fresh.category_id)
      } catch (ruleError) {
        logger.warn(MODULE, 'learn rule failed', { id: fresh.id, error: String(ruleError) })
      }
    }
    return ok(fresh)
  } catch (e) {
    logger.error(MODULE, 'updateTransaction failed', { id: data.id, error: String(e) })
    return appErr('DB_ERROR', 'Failed to update transaction', e)
  }
}

export async function deleteTransaction(id: string): Promise<Result<void, AppError>> {
  try {
    const existing = await q.getTransaction(id, getCurrentUserId())
    if (!existing) return appErr('NOT_FOUND', 'Transaction not found')
    await q.softDeleteTransaction(id, nowIso())
    void enqueue('finance_transaction', id, 'upsert')
    logger.info(MODULE, 'transaction deleted', { id })
    return ok(undefined)
  } catch (e) {
    logger.error(MODULE, 'deleteTransaction failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to delete transaction', e)
  }
}

export async function listCategories(): Promise<Result<Category[], AppError>> {
  try {
    const rows = await q.listCategories(getCurrentUserId())
    return ok(rows)
  } catch (e) {
    logger.error(MODULE, 'listCategories failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to load categories', e)
  }
}

export async function wipeAllData(): Promise<Result<{ deleted: number }, AppError>> {
  try {
    const { transactions, categories, rules } = await q.wipeFinanceData(getCurrentUserId())
    const total = transactions + categories + rules
    void enqueue('finance_transaction', 'ALL', 'wipe')
    void enqueue('finance_rule', 'ALL', 'wipe')
    void enqueue('finance_category', 'ALL', 'wipe')
    logger.info(MODULE, 'wipeAllData succeeded', { count: total })
    return ok({ deleted: total })
  } catch (e) {
    logger.error(MODULE, 'wipeAllData failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to wipe finance data', e)
  }
}

export async function createCategory(
  input: CreateCategoryInput
): Promise<Result<Category, AppError>> {
  const parsed = CreateCategoryInputSchema.safeParse(input)
  if (!parsed.success) {
    return appErr('VALIDATION_FAILED', parsed.error.issues[0]?.message ?? 'Invalid input', parsed.error)
  }
  const data = parsed.data
  try {
    const now = nowIso()
    const existing = await q.listCategories(getCurrentUserId())
    const cat: Category = {
      id: uuid(),
      user_id: getCurrentUserId(),
      name: data.name,
      icon: data.icon ?? 'tag',
      color: data.color,
      kind: data.kind,
      parent_id: null,
      sort_order: existing.length,
      monthly_budget_cents: data.monthly_budget_cents ?? null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      synced_at: null,
    }
    await q.insertCategory(cat)
    void enqueue('finance_category', cat.id, 'upsert')
    logger.info(MODULE, 'category created', { id: cat.id, name: cat.name })
    return ok(cat)
  } catch (e) {
    logger.error(MODULE, 'createCategory failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to create category', e)
  }
}

export async function updateCategory(
  input: UpdateCategoryInput
): Promise<Result<Category, AppError>> {
  const parsed = UpdateCategoryInputSchema.safeParse(input)
  if (!parsed.success) {
    return appErr('VALIDATION_FAILED', parsed.error.issues[0]?.message ?? 'Invalid input', parsed.error)
  }
  const data = parsed.data
  try {
    const existing = await q.getCategory(data.id, getCurrentUserId())
    if (!existing) return appErr('NOT_FOUND', 'Category not found')
    if (existing.user_id === null) return appErr('AUTH_FORBIDDEN', 'Cannot edit system categories')
    const patch: Partial<Category> = { updated_at: nowIso() }
    if (data.name !== undefined) patch.name = data.name
    if (data.icon !== undefined) patch.icon = data.icon
    if (data.color !== undefined) patch.color = data.color
    if (data.kind !== undefined) patch.kind = data.kind
    if ('monthly_budget_cents' in data) patch.monthly_budget_cents = data.monthly_budget_cents ?? null
    await q.updateCategory(data.id, patch)
    void enqueue('finance_category', data.id, 'upsert')
    const fresh = await q.getCategory(data.id, getCurrentUserId())
    if (!fresh) return appErr('INTERNAL', 'Updated category vanished')
    return ok(fresh)
  } catch (e) {
    logger.error(MODULE, 'updateCategory failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to update category', e)
  }
}

export async function deleteCategory(id: string): Promise<Result<void, AppError>> {
  try {
    const existing = await q.getCategory(id, getCurrentUserId())
    if (!existing) return appErr('NOT_FOUND', 'Category not found')
    if (existing.user_id === null) return appErr('AUTH_FORBIDDEN', 'Cannot delete system categories')
    await q.softDeleteCategory(id, nowIso())
    void enqueue('finance_category', id, 'upsert')
    logger.info(MODULE, 'category deleted', { id })
    return ok(undefined)
  } catch (e) {
    logger.error(MODULE, 'deleteCategory failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to delete category', e)
  }
}

export async function exportAllData(): Promise<Result<string, AppError>> {
  try {
    const { transactions, categories, rules } = await q.exportFinanceData(getCurrentUserId())
    const payload = {
      exported_at: new Date().toISOString(),
      version: 1,
      categories,
      rules,
      transactions,
    }
    return ok(JSON.stringify(payload, null, 2))
  } catch (e) {
    logger.error(MODULE, 'exportAllData failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to export data', e)
  }
}

export function isExpense(tx: Pick<Transaction, 'amount_cents'>): boolean {
  return tx.amount_cents < 0
}

import { getIntlLocale } from '@services/locale'

// Format amount for display. `language` controls digit grouping & currency symbol placement
// (e.g. fr: "1 234,56 €" vs en: "$1,234.56"). Defaults to 'en' if not provided.
export function formatAmount(cents: number, currency = 'VND', language = 'en'): string {
  const abs = Math.abs(cents)
  const locale = getIntlLocale(language)
  // VND and other no-minor-unit currencies: integer amount, append symbol manually
  // because some browsers' Intl.NumberFormat for VND adds odd spacing.
  if (currency === 'VND') {
    return new Intl.NumberFormat(locale).format(abs) + ' ₫'
  }
  if (currency === 'JPY' || currency === 'KRW') {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(abs)
  }
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(abs / 100)
}
