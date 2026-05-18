import { z } from 'zod'

export const MoodSchema = z.enum(['great', 'good', 'neutral', 'low', 'bad'])
export type Mood = z.infer<typeof MoodSchema>

export const CategoryKindSchema = z.enum(['essential', 'discretionary', 'income', 'savings'])
export type CategoryKind = z.infer<typeof CategoryKindSchema>

export const TransactionSourceSchema = z.enum(['manual', 'ocr', 'voice', 'import'])
export type TransactionSource = z.infer<typeof TransactionSourceSchema>

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
  location_lat: number | null
  location_lng: number | null
  location_label: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced_at: string | null
}

const TransactionInputBaseSchema = z.object({
  amount_cents: z.number().int().refine((n) => n !== 0, 'Amount cannot be zero'),
  currency: z.string().min(3).max(3).default('VND'),
  category_id: z.string().uuid(),
  merchant: z.string().max(120).optional(),
  note: z.string().max(500).optional(),
  occurred_at: z.string().datetime(),
  mood: MoodSchema.optional(),
  source: TransactionSourceSchema.default('manual'),
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
