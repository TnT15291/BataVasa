import { z } from 'zod'

export const MoodSchema = z.enum(['great', 'good', 'neutral', 'low', 'bad'])
export type Mood = z.infer<typeof MoodSchema>

export const CategoryKindSchema = z.enum(['essential', 'discretionary', 'income', 'savings'])
export type CategoryKind = z.infer<typeof CategoryKindSchema>

export const TransactionSourceSchema = z.enum(['manual', 'ocr', 'voice', 'import'])
export type TransactionSource = z.infer<typeof TransactionSourceSchema>

export const PlanItemKindSchema = z.enum(['income', 'expense'])
export type PlanItemKind = z.infer<typeof PlanItemKindSchema>

export const PlanItemStatusSchema = z.enum(['confirmed', 'expected'])
export type PlanItemStatus = z.infer<typeof PlanItemStatusSchema>

export type Category = {
  id: string
  user_id: string | null
  name: string
  icon: string
  color: string
  kind: CategoryKind
  parent_id: string | null
  sort_order: number
  monthly_budget_cents: number | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced_at: string | null
}

export const CreateCategoryInputSchema = z.object({
  name: z.string().min(1).max(60),
  icon: z.string().default('tag'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color'),
  kind: CategoryKindSchema,
  monthly_budget_cents: z.number().int().positive().nullable().optional(),
})
export type CreateCategoryInput = z.infer<typeof CreateCategoryInputSchema>

export const UpdateCategoryInputSchema = CreateCategoryInputSchema.partial().extend({
  id: z.string().uuid(),
})
export type UpdateCategoryInput = z.infer<typeof UpdateCategoryInputSchema>

export type Transaction = {
  id: string
  user_id: string | null
  amount_cents: number
  currency: string
  category_id: string
  merchant: string | null
  note: string | null
  occurred_at: string
  mood: Mood | null
  source: TransactionSource
  needs_review: number
  review_reason: string | null
  location_lat: number | null
  location_lng: number | null
  location_label: string | null
  // Explicit link to the plan item this transaction settles (user-confirmed).
  // plan_match_dismissed=1 means the user said "not that bill" — the
  // settle heuristic must never auto-match this transaction again.
  plan_item_id: string | null
  plan_match_dismissed: number
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced_at: string | null
}

export type TransactionRule = {
  id: string
  user_id: string | null
  merchant_pattern: string
  category_id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced_at: string | null
}

export type PlanItem = {
  id: string
  user_id: string | null
  name: string
  kind: PlanItemKind
  amount_cents: number
  currency: string
  category_id: string | null
  due_day: number
  status: PlanItemStatus
  active: number
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced_at: string | null
}

export const CreatePlanItemInputSchema = z.object({
  name: z.string().min(1).max(120),
  kind: PlanItemKindSchema,
  amount_cents: z.number().int().positive(),
  currency: z.string().min(3).max(3).default('VND'),
  category_id: z.string().uuid().nullable().optional(),
  due_day: z.number().int().min(1).max(31),
  status: PlanItemStatusSchema.default('confirmed'),
  active: z.number().int().min(0).max(1).optional(),
})
export type CreatePlanItemInput = z.infer<typeof CreatePlanItemInputSchema>

export const UpdatePlanItemInputSchema = CreatePlanItemInputSchema.partial().extend({
  id: z.string().uuid(),
})
export type UpdatePlanItemInput = z.infer<typeof UpdatePlanItemInputSchema>

export const DebtDirectionSchema = z.enum(['lent', 'borrowed'])
export type DebtDirection = z.infer<typeof DebtDirectionSchema>

export const DebtStatusSchema = z.enum(['open', 'settled'])
export type DebtStatus = z.infer<typeof DebtStatusSchema>

export type Debt = {
  id: string
  user_id: string | null
  // 'lent' = money I gave out (counts as expense); 'borrowed' = money I took (counts as income)
  direction: DebtDirection
  counterparty: string
  amount_cents: number
  currency: string
  note: string | null
  occurred_at: string
  // Repayment schedule. null = no due date agreed yet.
  due_at: string | null
  remind_days_before: number
  // Linked reminder that fires before/at the due date.
  reminder_id: string | null
  // The income/expense transaction created when the debt was recorded.
  transaction_id: string | null
  status: DebtStatus
  settled_at: string | null
  // The opposite transaction created when the debt was settled.
  settled_transaction_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced_at: string | null
}

export const CreateDebtInputSchema = z.object({
  direction: DebtDirectionSchema,
  counterparty: z.string().min(1).max(120),
  amount_cents: z.number().int().positive(),
  currency: z.string().min(3).max(3).default('VND'),
  note: z.string().max(500).optional(),
  occurred_at: z.string().datetime(),
  due_at: z.string().datetime().nullable().optional(),
  remind_days_before: z.number().int().min(0).max(90).default(1),
})
export type CreateDebtInput = z.infer<typeof CreateDebtInputSchema>

export const UpdateDebtInputSchema = z.object({
  id: z.string().uuid(),
  counterparty: z.string().min(1).max(120).optional(),
  amount_cents: z.number().int().positive().optional(),
  note: z.string().max(500).nullable().optional(),
  occurred_at: z.string().datetime().optional(),
  due_at: z.string().datetime().nullable().optional(),
  remind_days_before: z.number().int().min(0).max(90).optional(),
})
export type UpdateDebtInput = z.infer<typeof UpdateDebtInputSchema>

const TransactionInputBaseSchema = z.object({
  amount_cents: z.number().int().refine((n) => n !== 0, 'Amount cannot be zero'),
  currency: z.string().min(3).max(3).default('VND'),
  category_id: z.string().uuid(),
  merchant: z.string().max(120).optional(),
  note: z.string().max(500).optional(),
  occurred_at: z.string().datetime(),
  mood: MoodSchema.optional(),
  source: TransactionSourceSchema.default('manual'),
  needs_review: z.number().int().min(0).max(1).optional(),
  review_reason: z.string().max(200).optional(),
  location_lat: z.number().min(-90).max(90).optional(),
  location_lng: z.number().min(-180).max(180).optional(),
  location_label: z.string().max(200).optional(),
})

const futureDateGuard = (v: { occurred_at: string }) => {
  const occurred = Date.parse(v.occurred_at)
  const maxFuture = Date.now() + 24 * 60 * 60 * 1000
  return occurred <= maxFuture
}
const futureDateMsg = { message: 'occurred_at cannot be more than 24h in the future', path: ['occurred_at'] }

export const CreateTransactionInputSchema = TransactionInputBaseSchema.refine(futureDateGuard, futureDateMsg)
export type CreateTransactionInput = z.infer<typeof CreateTransactionInputSchema>

export const UpdateTransactionInputSchema = TransactionInputBaseSchema.partial()
  .extend({ id: z.string().uuid() })
  .refine(
    (v) => v.occurred_at === undefined || futureDateGuard({ occurred_at: v.occurred_at }),
    futureDateMsg
  )
export type UpdateTransactionInput = z.infer<typeof UpdateTransactionInputSchema>
