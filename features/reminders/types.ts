import { z } from 'zod'

export const RecurrenceSchema = z.enum(['none', 'daily', 'weekly', 'monthly'])
export type Recurrence = z.infer<typeof RecurrenceSchema>
export const ReminderPrioritySchema = z.enum(['low', 'medium', 'high'])
export type ReminderPriority = z.infer<typeof ReminderPrioritySchema>

export type Reminder = {
  id: string
  user_id: string | null
  title: string
  note: string | null
  remind_at: string        // actual notification fire time = event_at - advance_minutes
  advance_minutes: number  // minutes before the event to notify (0 = at event time)
  recurrence: Recurrence
  priority: ReminderPriority
  is_inbox: number // 0 | 1, 1 = unscheduled inbox item
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
  remind_at: z.string().datetime().optional(),
  advance_minutes: z.number().int().min(0).default(0),
  recurrence: RecurrenceSchema.default('none'),
  priority: ReminderPrioritySchema.optional(),
  is_inbox: z.number().int().min(0).max(1).optional(),
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
