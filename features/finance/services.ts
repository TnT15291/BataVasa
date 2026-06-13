import { ok, appErr, type Result, type AppError } from '@services/result'
import { uuid } from '@services/uuid'
import { logger } from '@services/logger'
import { getCurrentUserId } from '@services/identity'
import { nowIso } from '@db/core/db'
import * as q from '@db/finance/queries'
import { enqueue } from '@db/sync/queue'
import { track } from '@services/analytics'
import { convertMinorAmount } from '@services/fx'
import {
  CreateTransactionInputSchema,
  UpdateTransactionInputSchema,
  CreateCategoryInputSchema,
  UpdateCategoryInputSchema,
  CreatePlanItemInputSchema,
  UpdatePlanItemInputSchema,
  CreateDebtInputSchema,
  UpdateDebtInputSchema,
  type CreateTransactionInput,
  type UpdateTransactionInput,
  type CreateCategoryInput,
  type UpdateCategoryInput,
  type CreatePlanItemInput,
  type UpdatePlanItemInput,
  type CreateDebtInput,
  type UpdateDebtInput,
  type Transaction,
  type TransactionRule,
  type Category,
  type PlanItem,
  type Debt,
  type DebtDirection,
} from './types'
import {
  createReminder as createReminderSvc,
  updateReminder as updateReminderSvc,
  deleteReminder as deleteReminderSvc,
} from '@features/reminders/services'

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
      plan_item_id: null,
      plan_match_dismissed: 0,
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

export async function restoreTransaction(id: string): Promise<Result<Transaction, AppError>> {
  try {
    const existing = await q.getTransactionIncludingDeleted(id, getCurrentUserId())
    if (!existing) return appErr('NOT_FOUND', 'Transaction not found')
    await q.restoreTransaction(id, nowIso())
    void enqueue('finance_transaction', id, 'upsert')
    const fresh = await q.getTransaction(id, getCurrentUserId())
    if (!fresh) return appErr('INTERNAL', 'Restored row vanished')
    logger.info(MODULE, 'transaction restored', { id })
    return ok(fresh)
  } catch (e) {
    logger.error(MODULE, 'restoreTransaction failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to restore transaction', e)
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

/**
 * Budget cycle containing `now`: starts on `cycleStartDay` of each month
 * (clamped to the month's length, so 31 works in February) and runs to the
 * same day of the next month, exclusive. Default = calendar month.
 */
export function getCycleRange(now: Date, cycleStartDay = 1): { from: Date; to: Date } {
  const startFor = (year: number, month: number) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    return new Date(year, month, Math.min(cycleStartDay, daysInMonth))
  }
  let year = now.getFullYear()
  let month = now.getMonth()
  let from = startFor(year, month)
  if (now < from) {
    month -= 1
    if (month < 0) { month = 11; year -= 1 }
    from = startFor(year, month)
  }
  const to = month === 11 ? startFor(year + 1, 0) : startFor(year, month + 1)
  return { from, to }
}

const normalize = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

/**
 * A plan item counts as "already settled" this cycle when a transaction in
 * the cycle matches it. A user-confirmed link (`tx.plan_item_id`) settles
 * unconditionally; otherwise the heuristic applies: same direction +
 * currency, amount within ±10%, and either the merchant/note equals the
 * plan name or the category matches. Transactions the user linked to a
 * different item or explicitly dismissed never settle via heuristic.
 * Settled items leave the "remaining" bucket so a bill paid early is never
 * counted twice (once as recorded spending, once as upcoming).
 */
function planItemSettled(item: PlanItem, cycleTxs: Transaction[]): boolean {
  const name = normalize(item.name)
  const tolerance = item.amount_cents * 0.1
  return cycleTxs.some((tx) => {
    if (tx.plan_item_id === item.id) return true
    if (tx.plan_item_id || tx.plan_match_dismissed === 1) return false
    if (item.kind === 'expense' ? tx.amount_cents >= 0 : tx.amount_cents <= 0) return false
    if (tx.currency !== item.currency) return false
    if (Math.abs(Math.abs(tx.amount_cents) - item.amount_cents) > tolerance) return false
    const nameMatch = name !== '' && (normalize(tx.merchant) === name || normalize(tx.note) === name)
    const categoryMatch = item.category_id !== null && tx.category_id === item.category_id
    return nameMatch || categoryMatch
  })
}

/**
 * IDs of plan items already settled (paid/received) in the cycle containing
 * `now`. The UI uses this to badge items as paid — or drop them from the
 * "still to pay this month" list — instead of showing a settled bill as if
 * it were still owed.
 */
export function getSettledPlanItemIds(input: {
  planItems: PlanItem[]
  transactions: Transaction[]
  cycleStartDay?: number
  now?: Date
}): Set<string> {
  const now = input.now ?? new Date()
  const { from, to } = getCycleRange(now, input.cycleStartDay ?? 1)
  const cycleTxs = input.transactions.filter((tx) => {
    if (tx.deleted_at) return false
    const d = new Date(tx.occurred_at)
    return d >= from && d < to
  })
  const settled = new Set<string>()
  for (const item of input.planItems) {
    if (item.active !== 1 || item.deleted_at) continue
    if (planItemSettled(item, cycleTxs)) settled.add(item.id)
  }
  return settled
}

/**
 * Cross-Module Rule 5 applied to the monthly plan: when a fresh entry looks
 * like a plan item, the UI asks the user to confirm instead of silently
 * auto-settling. Returns the most likely candidate, or null.
 *
 * Deliberately looser than the settle heuristic — the user has the final
 * say, so name similarity is substring containment ("tiền điện EVN" matches
 * plan "Tiền điện") and the amount tolerance widens to ±25% on a name
 * match. Category-only matches keep the strict ±10%. Once confirmed, the
 * explicit link settles the item exactly; the difference between planned
 * and actual amount flows back into safe-to-spend through the formula.
 */
export function findMatchingPlanItem(input: {
  transaction: Transaction
  planItems: PlanItem[]
  transactions: Transaction[]
  cycleStartDay?: number
  now?: Date
}): PlanItem | null {
  const tx = input.transaction
  if (tx.plan_item_id || tx.plan_match_dismissed === 1) return null

  const now = input.now ?? new Date()
  const { from, to } = getCycleRange(now, input.cycleStartDay ?? 1)
  const occurred = new Date(tx.occurred_at)
  if (occurred < from || occurred >= to) return null

  const otherCycleTxs = input.transactions.filter((other) => {
    if (other.id === tx.id || other.deleted_at) return false
    const d = new Date(other.occurred_at)
    return d >= from && d < to
  })

  const txName = `${normalize(tx.merchant)} ${normalize(tx.note)}`.trim()
  let best: { item: PlanItem; nameMatch: boolean; diff: number } | null = null
  for (const item of input.planItems) {
    if (item.active !== 1 || item.deleted_at) continue
    if (item.kind === 'expense' ? tx.amount_cents >= 0 : tx.amount_cents <= 0) continue
    if (tx.currency !== item.currency) continue
    if (planItemSettled(item, otherCycleTxs)) continue

    const name = normalize(item.name)
    const nameMatch = name !== '' && txName !== '' && (txName.includes(name) || name.includes(txName))
    const diff = Math.abs(Math.abs(tx.amount_cents) - item.amount_cents)
    const tolerance = item.amount_cents * (nameMatch ? 0.25 : 0.1)
    const categoryMatch = item.category_id !== null && tx.category_id === item.category_id
    if (diff > tolerance || !(nameMatch || categoryMatch)) continue

    if (
      !best ||
      (nameMatch && !best.nameMatch) ||
      (nameMatch === best.nameMatch && diff < best.diff)
    ) {
      best = { item, nameMatch, diff }
    }
  }
  return best?.item ?? null
}

/**
 * User confirmed "yes, this is that planned expense/income": link the
 * transaction so the plan item is settled for this cycle. The unspent
 * remainder (planned − actual) returns to safe-to-spend automatically.
 */
export async function linkTransactionToPlanItem(
  txId: string,
  planItemId: string
): Promise<Result<Transaction, AppError>> {
  try {
    const existing = await q.getTransaction(txId, getCurrentUserId())
    if (!existing) return appErr('NOT_FOUND', 'Transaction not found')
    const item = await q.getPlanItem(planItemId, getCurrentUserId())
    if (!item) return appErr('NOT_FOUND', 'Finance plan item not found')
    await q.updateTransaction(txId, { plan_item_id: planItemId, plan_match_dismissed: 0, updated_at: nowIso() })
    void enqueue('finance_transaction', txId, 'upsert')
    const fresh = await q.getTransaction(txId, getCurrentUserId())
    if (!fresh) return appErr('INTERNAL', 'Updated row vanished')
    track('feature_used', { feature_name: 'plan_match_confirmed' })
    logger.info(MODULE, 'transaction linked to plan item', { id: txId, plan_item_id: planItemId })
    return ok(fresh)
  } catch (e) {
    logger.error(MODULE, 'linkTransactionToPlanItem failed', { id: txId, error: String(e) })
    return appErr('DB_ERROR', 'Failed to link transaction to plan item', e)
  }
}

/** User said "not that bill": remember it so the heuristic never auto-settles this transaction. */
export async function dismissPlanItemMatch(txId: string): Promise<Result<Transaction, AppError>> {
  try {
    const existing = await q.getTransaction(txId, getCurrentUserId())
    if (!existing) return appErr('NOT_FOUND', 'Transaction not found')
    await q.updateTransaction(txId, { plan_item_id: null, plan_match_dismissed: 1, updated_at: nowIso() })
    void enqueue('finance_transaction', txId, 'upsert')
    const fresh = await q.getTransaction(txId, getCurrentUserId())
    if (!fresh) return appErr('INTERNAL', 'Updated row vanished')
    track('feature_used', { feature_name: 'plan_match_dismissed' })
    return ok(fresh)
  } catch (e) {
    logger.error(MODULE, 'dismissPlanItemMatch failed', { id: txId, error: String(e) })
    return appErr('DB_ERROR', 'Failed to update transaction', e)
  }
}

/**
 * Money still safe to spend in the current budget cycle.
 *
 *   safeToSpend = income + plannedIncome − spending − setAside − plannedExpense
 *
 * - `income` counts received money, excluding withdrawals from savings-kind
 *   categories (taking money out of your own fund is not new income).
 * - `nonFundExpense` is true spending; `savingsSetAside` (allocations into
 *   savings-kind categories) is reported separately but still subtracted —
 *   money put away is not spendable.
 * - Plan items occur once per cycle: every active item that has NOT been
 *   settled by a matching transaction stays in the planned buckets, whether
 *   its due day already passed (overdue bills still owe money) or not.
 * - When `fxRates` is provided, foreign-currency rows are converted into
 *   `currency`; without rates they are skipped (legacy behavior).
 * - The result may be negative: a deficit is information, not noise.
 */
export function calculateSafeToSpend(input: {
  transactions: Transaction[]
  categories: Category[]
  planItems?: PlanItem[]
  debts?: Debt[]
  currency: string
  fxRates?: Record<string, number> | null
  cycleStartDay?: number
  // When false, expected-but-not-yet-received income (income plan items, money
  // owed to you) is shown in the breakdown but NOT added to the spendable total
  // — for users who only want to spend money they actually hold. Default true.
  countPlannedIncome?: boolean
  // When true, the previous cycle's leftover (its own safeToSpend) is rolled
  // into this cycle — surplus adds, deficit subtracts. Looks back exactly one
  // cycle (non-recursive), so the carried figure equals what the user saw last
  // cycle. Default false. See safeToSpendCarryOver setting.
  countCarryOver?: boolean
  now?: Date
}): {
  income: number
  plannedIncome: number
  nonFundExpense: number
  savingsSetAside: number
  plannedExpense: number
  // Leftover rolled in from the previous cycle (0 unless countCarryOver).
  carryOver: number
  safeToSpend: number
  // Rows in this cycle that could not be converted to `currency` (foreign
  // currency with no FX rate available) and were therefore left out. When > 0
  // the total understates real spending — surface a warning, don't hide it.
  skippedForeign: number
  cycleFrom: Date
  cycleTo: Date
} {
  const now = input.now ?? new Date()
  const { from, to } = getCycleRange(now, input.cycleStartDay ?? 1)
  const countPlannedIncome = input.countPlannedIncome ?? true
  // One cycle back, non-recursive: the previous window ends the instant before
  // this one starts. countCarryOver:false on the inner call prevents recursion.
  const carryOver = (input.countCarryOver ?? false)
    ? calculateSafeToSpend({ ...input, countCarryOver: false, now: new Date(from.getTime() - 1) }).safeToSpend
    : 0
  const savingsCategoryIds = new Set(
    input.categories.filter((c) => c.kind === 'savings').map((c) => c.id)
  )
  let skippedForeign = 0
  const inTarget = (amount: number, currency: string): number | null => {
    if (currency === input.currency) return amount
    const converted = input.fxRates
      ? convertMinorAmount(amount, currency, input.currency, input.fxRates)
      : null
    if (converted === null) skippedForeign += 1
    return converted
  }

  let income = 0
  let nonFundExpense = 0
  let savingsSetAside = 0
  let plannedIncome = 0
  let plannedExpense = 0

  const cycleTxs = input.transactions.filter((tx) => {
    const d = new Date(tx.occurred_at)
    return d >= from && d < to
  })

  for (const tx of cycleTxs) {
    const amount = inTarget(tx.amount_cents, tx.currency)
    if (amount === null) continue
    const isSavings = savingsCategoryIds.has(tx.category_id)
    if (amount > 0) {
      if (!isSavings) income += amount
      continue
    }
    if (isSavings) savingsSetAside += Math.abs(amount)
    else nonFundExpense += Math.abs(amount)
  }

  for (const item of input.planItems ?? []) {
    if (item.active !== 1 || item.deleted_at) continue
    if (planItemSettled(item, cycleTxs)) continue
    const amount = inTarget(item.amount_cents, item.currency)
    if (amount === null) continue
    if (item.kind === 'income') plannedIncome += amount
    else plannedExpense += amount
  }

  for (const debt of input.debts ?? []) {
    if (debt.deleted_at || debt.status !== 'open' || !debt.due_at) continue
    const due = new Date(debt.due_at)
    if (due < from || due >= to) continue
    const amount = inTarget(debt.amount_cents, debt.currency)
    if (amount === null) continue
    if (debt.direction === 'borrowed') plannedExpense += amount
    else plannedIncome += amount
  }

  return {
    income,
    plannedIncome,
    nonFundExpense,
    savingsSetAside,
    plannedExpense,
    carryOver,
    safeToSpend:
      carryOver + income + (countPlannedIncome ? plannedIncome : 0) - nonFundExpense - savingsSetAside - plannedExpense,
    skippedForeign,
    cycleFrom: from,
    cycleTo: to,
  }
}

// ─── Debt book (sổ nợ) ────────────────────────────────────────────────────────

// Canonical system category names (translated at display time, finance/i18n.ts).
// Money out (lend out, repay what I borrowed) → Lending (expense side).
// Money in (borrow, collect what I lent) → Borrowing (income side).
const DEBT_CATEGORY = { out: 'Lending', in: 'Borrowing' } as const

// UI passes pre-translated strings so the service stays language-agnostic.
export type DebtLabels = {
  reminderTitle?: string
  reminderNote?: string
  settleNote?: string
}

async function findDebtCategory(flow: 'in' | 'out'): Promise<Category | null> {
  const cats = await q.listCategories(getCurrentUserId())
  return cats.find((c) => c.user_id === null && c.name === DEBT_CATEGORY[flow]) ?? null
}

/** Signed transaction amount for the original debt entry. */
function debtSignedAmount(direction: DebtDirection, amountCents: number): number {
  // Lending money out is an expense; borrowing money is income.
  return direction === 'lent' ? -amountCents : amountCents
}

function debtReminderTimes(dueAt: string, remindDaysBefore: number): { remind_at: string; advance_minutes: number } {
  const advance = remindDaysBefore * 24 * 60
  return {
    remind_at: new Date(new Date(dueAt).getTime() - advance * 60000).toISOString(),
    advance_minutes: advance,
  }
}

export async function listDebts(): Promise<Result<Debt[], AppError>> {
  try {
    const rows = await q.listDebts(getCurrentUserId())
    return ok(rows)
  } catch (e) {
    logger.error(MODULE, 'listDebts failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to load debts', e)
  }
}

export async function getDebt(id: string): Promise<Result<Debt, AppError>> {
  try {
    const row = await q.getDebt(id, getCurrentUserId())
    if (!row) return appErr('NOT_FOUND', 'Debt not found')
    return ok(row)
  } catch (e) {
    logger.error(MODULE, 'getDebt failed', { id, error: String(e) })
    return appErr('DB_ERROR', 'Failed to load debt', e)
  }
}

/**
 * Record a debt: creates the money movement (borrowed = income, lent =
 * expense), an optional due-date reminder (notification fires
 * `remind_days_before` days ahead), and the debt row linking both.
 */
export async function createDebt(
  input: CreateDebtInput,
  labels: DebtLabels = {}
): Promise<Result<Debt, AppError>> {
  const parsed = CreateDebtInputSchema.safeParse(input)
  if (!parsed.success) {
    return appErr('VALIDATION_FAILED', parsed.error.issues[0]?.message ?? 'Invalid input', parsed.error)
  }
  const data = parsed.data

  try {
    const category = await findDebtCategory(data.direction === 'lent' ? 'out' : 'in')
    if (!category) return appErr('INTERNAL', 'Debt categories are missing — restart the app to re-seed')

    const txResult = await createTransaction({
      amount_cents: debtSignedAmount(data.direction, data.amount_cents),
      currency: data.currency,
      category_id: category.id,
      merchant: data.counterparty,
      note: data.note,
      occurred_at: data.occurred_at,
      source: 'manual',
    })
    if (!txResult.ok) return txResult

    let reminderId: string | null = null
    if (data.due_at) {
      const times = debtReminderTimes(data.due_at, data.remind_days_before)
      const reminderResult = await createReminderSvc({
        title: labels.reminderTitle ?? data.counterparty,
        note: labels.reminderNote,
        remind_at: times.remind_at,
        advance_minutes: times.advance_minutes,
        recurrence: 'none',
        priority: 'high',
      })
      if (reminderResult.ok) {
        reminderId = reminderResult.value.id
      } else {
        // The debt itself must still save (Rule 8: surface, don't silently die).
        logger.warn(MODULE, 'debt reminder creation failed', { error: reminderResult.error.message })
      }
    }

    const now = nowIso()
    const debt: Debt = {
      id: uuid(),
      user_id: getCurrentUserId(),
      direction: data.direction,
      counterparty: data.counterparty.trim(),
      amount_cents: data.amount_cents,
      currency: data.currency,
      note: data.note ?? null,
      occurred_at: data.occurred_at,
      due_at: data.due_at ?? null,
      remind_days_before: data.remind_days_before,
      reminder_id: reminderId,
      transaction_id: txResult.value.id,
      status: 'open',
      settled_at: null,
      settled_transaction_id: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      synced_at: null,
    }
    await q.insertDebt(debt)
    void enqueue('finance_debt', debt.id, 'upsert')
    track('feature_used', { feature_name: 'debt_created' })
    logger.info(MODULE, 'debt created', { id: debt.id, direction: debt.direction })
    return ok(debt)
  } catch (e) {
    logger.error(MODULE, 'createDebt failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to create debt', e)
  }
}

export async function updateDebt(
  input: UpdateDebtInput,
  labels: DebtLabels = {}
): Promise<Result<Debt, AppError>> {
  const parsed = UpdateDebtInputSchema.safeParse(input)
  if (!parsed.success) {
    return appErr('VALIDATION_FAILED', parsed.error.issues[0]?.message ?? 'Invalid input', parsed.error)
  }
  const data = parsed.data
  try {
    const existing = await q.getDebt(data.id, getCurrentUserId())
    if (!existing) return appErr('NOT_FOUND', 'Debt not found')
    if (existing.status === 'settled' && data.amount_cents !== undefined && data.amount_cents !== existing.amount_cents) {
      return appErr('VALIDATION_FAILED', 'Cannot change the amount of a settled debt')
    }

    const patch: Partial<Debt> = { updated_at: nowIso() }
    if (data.counterparty !== undefined) patch.counterparty = data.counterparty.trim()
    if (data.amount_cents !== undefined) patch.amount_cents = data.amount_cents
    if ('note' in data) patch.note = data.note ?? null
    if (data.occurred_at !== undefined) patch.occurred_at = data.occurred_at
    if ('due_at' in data) patch.due_at = data.due_at ?? null
    if (data.remind_days_before !== undefined) patch.remind_days_before = data.remind_days_before

    // Keep the linked money movement in step with the debt record.
    if (existing.transaction_id) {
      const txPatch: UpdateTransactionInput = { id: existing.transaction_id }
      if (patch.counterparty !== undefined) txPatch.merchant = patch.counterparty
      if (patch.amount_cents !== undefined) {
        txPatch.amount_cents = debtSignedAmount(existing.direction, patch.amount_cents)
      }
      if ('note' in data) txPatch.note = data.note ?? ''
      if (patch.occurred_at !== undefined) txPatch.occurred_at = patch.occurred_at
      if (Object.keys(txPatch).length > 1) {
        const txResult = await updateTransaction(txPatch)
        if (!txResult.ok && txResult.error.code !== 'NOT_FOUND') return txResult
      }
    }

    // Reconcile the due-date reminder with the new schedule.
    const nextDueAt = 'due_at' in data ? data.due_at ?? null : existing.due_at
    const nextRemindDays = data.remind_days_before ?? existing.remind_days_before
    const scheduleChanged =
      nextDueAt !== existing.due_at ||
      nextRemindDays !== existing.remind_days_before ||
      (patch.counterparty !== undefined && patch.counterparty !== existing.counterparty)
    if (existing.status === 'open' && scheduleChanged) {
      if (!nextDueAt && existing.reminder_id) {
        const r = await deleteReminderSvc(existing.reminder_id)
        if (!r.ok) logger.warn(MODULE, 'debt reminder delete failed', { error: r.error.message })
        patch.reminder_id = null
      } else if (nextDueAt) {
        const times = debtReminderTimes(nextDueAt, nextRemindDays)
        if (existing.reminder_id) {
          const r = await updateReminderSvc({
            id: existing.reminder_id,
            ...(labels.reminderTitle ? { title: labels.reminderTitle } : {}),
            remind_at: times.remind_at,
            advance_minutes: times.advance_minutes,
          })
          if (!r.ok && r.error.code === 'NOT_FOUND') patch.reminder_id = null
          else if (!r.ok) logger.warn(MODULE, 'debt reminder update failed', { error: r.error.message })
        } else {
          const r = await createReminderSvc({
            title: labels.reminderTitle ?? (patch.counterparty ?? existing.counterparty),
            note: labels.reminderNote,
            remind_at: times.remind_at,
            advance_minutes: times.advance_minutes,
            recurrence: 'none',
            priority: 'high',
          })
          if (r.ok) patch.reminder_id = r.value.id
          else logger.warn(MODULE, 'debt reminder creation failed', { error: r.error.message })
        }
      }
    }

    await q.updateDebt(data.id, patch)
    void enqueue('finance_debt', data.id, 'upsert')
    const fresh = await q.getDebt(data.id, getCurrentUserId())
    if (!fresh) return appErr('INTERNAL', 'Updated row vanished')
    logger.info(MODULE, 'debt updated', { id: data.id })
    return ok(fresh)
  } catch (e) {
    logger.error(MODULE, 'updateDebt failed', { id: data.id, error: String(e) })
    return appErr('DB_ERROR', 'Failed to update debt', e)
  }
}

/**
 * Mark a debt as fully repaid: records the opposite money movement
 * (collecting a loan = income, repaying a borrow = expense), completes the
 * linked reminder, and closes the debt.
 */
export async function settleDebt(
  id: string,
  labels: DebtLabels = {}
): Promise<Result<Debt, AppError>> {
  try {
    const existing = await q.getDebt(id, getCurrentUserId())
    if (!existing) return appErr('NOT_FOUND', 'Debt not found')
    if (existing.status === 'settled') return appErr('VALIDATION_FAILED', 'Debt is already settled')

    const category = await findDebtCategory(existing.direction === 'lent' ? 'in' : 'out')
    if (!category) return appErr('INTERNAL', 'Debt categories are missing — restart the app to re-seed')

    const now = nowIso()
    const txResult = await createTransaction({
      // Opposite sign of the original entry: collecting = +, repaying = −.
      amount_cents: -debtSignedAmount(existing.direction, existing.amount_cents),
      currency: existing.currency,
      category_id: category.id,
      merchant: existing.counterparty,
      note: labels.settleNote,
      occurred_at: now,
      source: 'manual',
    })
    if (!txResult.ok) return txResult

    if (existing.reminder_id) {
      const r = await updateReminderSvc({ id: existing.reminder_id, completed: 1 })
      if (!r.ok && r.error.code !== 'NOT_FOUND') {
        logger.warn(MODULE, 'debt reminder completion failed', { error: r.error.message })
      }
    }

    await q.updateDebt(id, {
      status: 'settled',
      settled_at: now,
      settled_transaction_id: txResult.value.id,
      updated_at: now,
    })
    void enqueue('finance_debt', id, 'upsert')
    const fresh = await q.getDebt(id, getCurrentUserId())
    if (!fresh) return appErr('INTERNAL', 'Updated row vanished')
    track('feature_used', { feature_name: 'debt_settled' })
    logger.info(MODULE, 'debt settled', { id })
    return ok(fresh)
  } catch (e) {
    logger.error(MODULE, 'settleDebt failed', { id, error: String(e) })
    return appErr('DB_ERROR', 'Failed to settle debt', e)
  }
}

/** Deletes the debt together with its linked transactions and reminder. */
export async function deleteDebt(id: string): Promise<Result<void, AppError>> {
  try {
    const existing = await q.getDebt(id, getCurrentUserId())
    if (!existing) return appErr('NOT_FOUND', 'Debt not found')
    await q.softDeleteDebt(id, nowIso())
    void enqueue('finance_debt', id, 'upsert')
    for (const txId of [existing.transaction_id, existing.settled_transaction_id]) {
      if (!txId) continue
      const r = await deleteTransaction(txId)
      if (!r.ok && r.error.code !== 'NOT_FOUND') {
        logger.warn(MODULE, 'debt transaction delete failed', { id: txId, error: r.error.message })
      }
    }
    if (existing.reminder_id && existing.status === 'open') {
      const r = await deleteReminderSvc(existing.reminder_id)
      if (!r.ok && r.error.code !== 'NOT_FOUND') {
        logger.warn(MODULE, 'debt reminder delete failed', { error: r.error.message })
      }
    }
    logger.info(MODULE, 'debt deleted', { id })
    return ok(undefined)
  } catch (e) {
    logger.error(MODULE, 'deleteDebt failed', { id, error: String(e) })
    return appErr('DB_ERROR', 'Failed to delete debt', e)
  }
}

/** Undo of deleteDebt: restores the debt and its linked transactions (the reminder stays deleted). */
export async function restoreDebt(id: string): Promise<Result<Debt, AppError>> {
  try {
    const existing = await q.getDebtIncludingDeleted(id, getCurrentUserId())
    if (!existing) return appErr('NOT_FOUND', 'Debt not found')
    await q.restoreDebt(id, nowIso())
    void enqueue('finance_debt', id, 'upsert')
    for (const txId of [existing.transaction_id, existing.settled_transaction_id]) {
      if (!txId) continue
      const r = await restoreTransaction(txId)
      if (!r.ok && r.error.code !== 'NOT_FOUND') {
        logger.warn(MODULE, 'debt transaction restore failed', { id: txId, error: r.error.message })
      }
    }
    const fresh = await q.getDebt(id, getCurrentUserId())
    if (!fresh) return appErr('INTERNAL', 'Restored row vanished')
    logger.info(MODULE, 'debt restored', { id })
    return ok(fresh)
  } catch (e) {
    logger.error(MODULE, 'restoreDebt failed', { id, error: String(e) })
    return appErr('DB_ERROR', 'Failed to restore debt', e)
  }
}

/** Outstanding totals for open debts in `currency` (other currencies are skipped). */
export function summarizeDebts(
  debts: Debt[],
  currency: string
): { lentOutstanding: number; borrowedOutstanding: number; openCount: number; overdueCount: number } {
  let lentOutstanding = 0
  let borrowedOutstanding = 0
  let openCount = 0
  let overdueCount = 0
  const now = new Date()
  for (const debt of debts) {
    if (debt.deleted_at || debt.status !== 'open') continue
    openCount += 1
    if (debt.due_at && new Date(debt.due_at) < now) overdueCount += 1
    if (debt.currency !== currency) continue
    if (debt.direction === 'lent') lentOutstanding += debt.amount_cents
    else borrowedOutstanding += debt.amount_cents
  }
  return { lentOutstanding, borrowedOutstanding, openCount, overdueCount }
}

export async function wipeAllData(): Promise<Result<{ deleted: number }, AppError>> {
  try {
    const { transactions, categories, rules, planItems, debts } = await q.wipeFinanceData(getCurrentUserId())
    const total = transactions + categories + rules + planItems + debts
    void enqueue('finance_transaction', 'ALL', 'wipe')
    void enqueue('finance_rule', 'ALL', 'wipe')
    void enqueue('finance_plan_item', 'ALL', 'wipe')
    void enqueue('finance_debt', 'ALL', 'wipe')
    void enqueue('finance_category', 'ALL', 'wipe')
    logger.info(MODULE, 'wipeAllData succeeded', { count: total })
    return ok({ deleted: total })
  } catch (e) {
    logger.error(MODULE, 'wipeAllData failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to wipe finance data', e)
  }
}

export async function listPlanItems(): Promise<Result<PlanItem[], AppError>> {
  try {
    const rows = await q.listPlanItems(getCurrentUserId())
    return ok(rows)
  } catch (e) {
    logger.error(MODULE, 'listPlanItems failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to load finance plan', e)
  }
}

export async function createPlanItem(input: CreatePlanItemInput): Promise<Result<PlanItem, AppError>> {
  const parsed = CreatePlanItemInputSchema.safeParse(input)
  if (!parsed.success) {
    return appErr('VALIDATION_FAILED', parsed.error.issues[0]?.message ?? 'Invalid input', parsed.error)
  }
  const data = parsed.data
  try {
    const now = nowIso()
    const item: PlanItem = {
      id: uuid(),
      user_id: getCurrentUserId(),
      name: data.name.trim(),
      kind: data.kind,
      amount_cents: data.amount_cents,
      currency: data.currency,
      category_id: data.category_id ?? null,
      due_day: data.due_day,
      status: data.status,
      active: data.active ?? 1,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      synced_at: null,
    }
    await q.upsertPlanItem(item)
    void enqueue('finance_plan_item', item.id, 'upsert')
    logger.info(MODULE, 'plan item created', { id: item.id, kind: item.kind })
    return ok(item)
  } catch (e) {
    logger.error(MODULE, 'createPlanItem failed', { error: String(e) })
    return appErr('DB_ERROR', 'Failed to create finance plan item', e)
  }
}

export async function updatePlanItem(input: UpdatePlanItemInput): Promise<Result<PlanItem, AppError>> {
  const parsed = UpdatePlanItemInputSchema.safeParse(input)
  if (!parsed.success) {
    return appErr('VALIDATION_FAILED', parsed.error.issues[0]?.message ?? 'Invalid input', parsed.error)
  }
  const data = parsed.data
  try {
    const existing = await q.getPlanItem(data.id, getCurrentUserId())
    if (!existing) return appErr('NOT_FOUND', 'Finance plan item not found')
    const patch: Partial<PlanItem> = { updated_at: nowIso() }
    if (data.name !== undefined) patch.name = data.name.trim()
    if (data.kind !== undefined) patch.kind = data.kind
    if (data.amount_cents !== undefined) patch.amount_cents = data.amount_cents
    if (data.currency !== undefined) patch.currency = data.currency
    if ('category_id' in data) patch.category_id = data.category_id ?? null
    if (data.due_day !== undefined) patch.due_day = data.due_day
    if (data.status !== undefined) patch.status = data.status
    if (data.active !== undefined) patch.active = data.active
    await q.updatePlanItem(data.id, patch)
    void enqueue('finance_plan_item', data.id, 'upsert')
    const fresh = await q.getPlanItem(data.id, getCurrentUserId())
    if (!fresh) return appErr('INTERNAL', 'Updated row vanished')
    return ok(fresh)
  } catch (e) {
    logger.error(MODULE, 'updatePlanItem failed', { id: data.id, error: String(e) })
    return appErr('DB_ERROR', 'Failed to update finance plan item', e)
  }
}

export async function deletePlanItem(id: string): Promise<Result<void, AppError>> {
  try {
    const existing = await q.getPlanItem(id, getCurrentUserId())
    if (!existing) return appErr('NOT_FOUND', 'Finance plan item not found')
    await q.softDeletePlanItem(id, nowIso())
    void enqueue('finance_plan_item', id, 'upsert')
    return ok(undefined)
  } catch (e) {
    logger.error(MODULE, 'deletePlanItem failed', { id, error: String(e) })
    return appErr('DB_ERROR', 'Failed to delete finance plan item', e)
  }
}

export async function restorePlanItem(id: string): Promise<Result<PlanItem, AppError>> {
  try {
    const existing = await q.getPlanItemIncludingDeleted(id, getCurrentUserId())
    if (!existing) return appErr('NOT_FOUND', 'Finance plan item not found')
    await q.restorePlanItem(id, nowIso())
    void enqueue('finance_plan_item', id, 'upsert')
    const fresh = await q.getPlanItem(id, getCurrentUserId())
    if (!fresh) return appErr('INTERNAL', 'Restored row vanished')
    return ok(fresh)
  } catch (e) {
    logger.error(MODULE, 'restorePlanItem failed', { id, error: String(e) })
    return appErr('DB_ERROR', 'Failed to restore finance plan item', e)
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
    const { transactions, categories, rules, planItems, debts } = await q.exportFinanceData(getCurrentUserId())
    const payload = {
      exported_at: new Date().toISOString(),
      version: 1,
      categories,
      rules,
      planItems,
      debts,
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

export type CategoryBreakdownDirection = 'income' | 'expense'

export type CategoryBreakdownItem = {
  categoryId: string
  category: Category | undefined
  amount: number
}

export type CategoryBreakdown = {
  items: CategoryBreakdownItem[]
  total: number
}

/**
 * Groups signed transactions into category proportions for report charts.
 * Amounts are always positive in the returned buckets. Foreign-currency rows
 * can be skipped by returning null from `convertAmount`.
 */
export function buildCategoryBreakdown(input: {
  transactions: Transaction[]
  categories: Category[]
  direction: CategoryBreakdownDirection
  limit?: number
  convertAmount?: (amount: number, currency: string) => number | null
}): CategoryBreakdown {
  const catById = new Map(input.categories.map((cat) => [cat.id, cat]))
  const catMap = new Map<string, CategoryBreakdownItem>()
  const wantsIncome = input.direction === 'income'

  for (const tx of input.transactions) {
    if (wantsIncome ? tx.amount_cents <= 0 : tx.amount_cents >= 0) continue
    const converted = input.convertAmount
      ? input.convertAmount(tx.amount_cents, tx.currency)
      : tx.amount_cents
    if (converted === null || converted === 0) continue

    const amount = Math.abs(converted)
    const existing = catMap.get(tx.category_id)
    if (existing) existing.amount += amount
    else catMap.set(tx.category_id, {
      categoryId: tx.category_id,
      category: catById.get(tx.category_id),
      amount,
    })
  }

  const sorted = Array.from(catMap.values()).sort((a, b) => b.amount - a.amount)
  const limit = input.limit ?? 5
  const top = sorted.slice(0, limit)
  const othersAmount = sorted.slice(limit).reduce((sum, item) => sum + item.amount, 0)
  if (othersAmount > 0) {
    top.push({ categoryId: '__others__', category: undefined, amount: othersAmount })
  }
  return {
    items: top,
    total: top.reduce((sum, item) => sum + item.amount, 0),
  }
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

/**
 * Parse a user-typed amount into display units (whole VND, dollars, …).
 * Accepts grouping separators ("1.200.000", "1,200,000", "1 200") and a
 * decimal part with 1-2 digits after "." or "," ("12.50", "12,5").
 * Returns null when the text is not a positive amount.
 */
export function parseAmountInput(text: string): number | null {
  const cleaned = text.trim()
  if (!cleaned) return null
  const m = cleaned.match(/^(\d{1,3}(?:[.,\s]\d{3})*|\d+)(?:[.,](\d{1,2}))?$/)
  if (!m) return null
  const whole = Number(m[1]!.replace(/[.,\s]/g, ''))
  const value = m[2] ? whole + Number(`0.${m[2]}`) : whole
  return Number.isFinite(value) && value > 0 ? value : null
}
