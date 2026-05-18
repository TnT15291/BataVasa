import { z } from 'zod'

export type Journal = {
  id: string
  user_id: string | null
  content: string
  mood: number | null // 1-5: very sad → very happy
  occurred_at: string
  location_lat: number | null
  location_lng: number | null
  location_label: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced_at: string | null
}

export const CreateJournalInputSchema = z.object({
  content: z.string().min(1).max(10000),
  mood: z.number().int().min(1).max(5).optional(),
  occurred_at: z.string().datetime(),
  location_lat: z.number().min(-90).max(90).optional(),
  location_lng: z.number().min(-180).max(180).optional(),
  location_label: z.string().max(200).optional(),
})
export type CreateJournalInput = z.infer<typeof CreateJournalInputSchema>

export const UpdateJournalInputSchema = CreateJournalInputSchema.partial().extend({
  id: z.string().uuid(),
})
export type UpdateJournalInput = z.infer<typeof UpdateJournalInputSchema>
