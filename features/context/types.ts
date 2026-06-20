import { z } from 'zod'

export const ContextKindSchema = z.enum(['goal', 'preference', 'fact'])
export type ContextKind = z.infer<typeof ContextKindSchema>

export type UserContextEntry = {
  id: string
  user_id: string | null
  kind: ContextKind
  content: string
  /** 1 = pinned (kept at the top and prioritized for the AI prompt). */
  pinned: number
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced_at: string | null
}

export const CreateContextInputSchema = z.object({
  kind: ContextKindSchema.default('fact'),
  content: z.string().trim().min(1).max(280),
  pinned: z.boolean().optional(),
})
export type CreateContextInput = z.infer<typeof CreateContextInputSchema>

export const UpdateContextInputSchema = z.object({
  id: z.string().uuid(),
  kind: ContextKindSchema.optional(),
  content: z.string().trim().min(1).max(280).optional(),
  pinned: z.boolean().optional(),
})
export type UpdateContextInput = z.infer<typeof UpdateContextInputSchema>
