import { z } from 'zod'

export const CadenceSchema = z.enum(['daily', 'weekdays', 'weekly'])
export type Cadence = z.infer<typeof CadenceSchema>

export type Habit = {
  id: string
  user_id: string | null
  name: string
  icon: string
  color: string
  cadence: Cadence
  target_per_period: number
  location_lat: number | null
  location_lng: number | null
  location_label: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced_at: string | null
}

export type HabitLog = {
  id: string
  habit_id: string
  user_id: string | null
  occurred_at: string
  note: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced_at: string | null
}

export const CreateHabitInputSchema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().min(1).max(10).default('✅'),
  color: z.string().min(4).max(9).default('#4CAF50'),
  cadence: CadenceSchema.default('daily'),
  target_per_period: z.number().int().min(1).max(99).default(1),
  location_lat: z.number().min(-90).max(90).optional(),
  location_lng: z.number().min(-180).max(180).optional(),
  location_label: z.string().max(200).optional(),
})
export type CreateHabitInput = z.infer<typeof CreateHabitInputSchema>

export const UpdateHabitInputSchema = CreateHabitInputSchema.partial().extend({
  id: z.string().uuid(),
})
export type UpdateHabitInput = z.infer<typeof UpdateHabitInputSchema>

export const CreateHabitLogInputSchema = z.object({
  habit_id: z.string().uuid(),
  occurred_at: z.string().datetime(),
  note: z.string().max(500).optional(),
})
export type CreateHabitLogInput = z.infer<typeof CreateHabitLogInputSchema>
