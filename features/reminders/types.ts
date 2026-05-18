import { z } from 'zod'

export const RecurrenceSchema = z.enum(['none', 'daily', 'weekly', 'monthly'])
export type Recurrence = z.infer<typeof RecurrenceSchema>

export type Reminder = {
  id: string
  user_id: string | null
  title: string
  note: string | null
  remind_at: string
  recurrence: Recurrence
  completed: number // 0 | 1 (SQLite boolean)
  location_lat: number | null
  location_lng: number | null
  location_label: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced_at: string | null
}

export const CreateReminderInputSchema = z.object({
  title: z.string().min(1).max(200),
  note: z.string().max(500).optional(),
  remind_at: z.string().datetime(),
  recurrence: RecurrenceSchema.default('none'),
  location_lat: z.number().min(-90).max(90).optional(),
  location_lng: z.number().min(-180).max(180).optional(),
  location_label: z.string().max(200).optional(),
})
export type CreateReminderInput = z.infer<typeof CreateReminderInputSchema>

export const UpdateReminderInputSchema = CreateReminderInputSchema.partial().extend({
  id: z.string().uuid(),
  completed: z.number().int().min(0).max(1).optional(),
})
export type UpdateReminderInput = z.infer<typeof UpdateReminderInputSchema>
