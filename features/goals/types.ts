import { z } from 'zod'

export const GoalStatusSchema = z.enum(['active', 'paused', 'done', 'archived'])
export type GoalStatus = z.infer<typeof GoalStatusSchema>

export const GoalTargetTypeSchema = z.enum(['amount', 'rate', 'count'])
export type GoalTargetType = z.infer<typeof GoalTargetTypeSchema>

export const GoalMetricBindingSchema = z.discriminatedUnion('module', [
  z.object({
    module: z.literal('finance'),
    aggregation: z.literal('sum_amount'),
    category_id: z.string().min(1),
    kind: z.enum(['income', 'expense', 'savings']).optional(),
  }),
  z.object({
    module: z.literal('habits'),
    aggregation: z.literal('completion_rate'),
    habit_id: z.string().min(1),
  }),
  z.object({
    module: z.literal('journals'),
    aggregation: z.literal('entry_count'),
    // An activity tag (work/health/money/...) or 'all' for every entry.
    tag: z.string().min(1),
  }),
  z.object({
    module: z.literal('reminders'),
    aggregation: z.literal('completed_count'),
  }),
])
export type GoalMetricBinding = z.infer<typeof GoalMetricBindingSchema>

export type Goal = {
  id: string
  user_id: string | null
  title: string
  description: string | null
  target_type: GoalTargetType
  target_value: number
  unit: string
  start_date: string
  due_date: string | null
  metric_binding: string
  status: GoalStatus
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced_at: string | null
}

export type GoalProgress = {
  current: number
  target: number
  percent: number
  label: string
  sourceLabel: string
  // Optional secondary detail (e.g. average mood for journal-area goals).
  note?: string
}

export type GoalWithProgress = Goal & {
  binding: GoalMetricBinding | null
  progress: GoalProgress
}

export const CreateGoalInputSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  target_type: GoalTargetTypeSchema,
  target_value: z.number().positive(),
  unit: z.string().min(1).max(24),
  start_date: z.string().min(10).max(30),
  due_date: z.string().min(10).max(30).nullable().optional(),
  metric_binding: GoalMetricBindingSchema,
})
export type CreateGoalInput = z.infer<typeof CreateGoalInputSchema>

export const UpdateGoalInputSchema = CreateGoalInputSchema.partial().extend({
  id: z.string().uuid(),
  status: GoalStatusSchema.optional(),
})
export type UpdateGoalInput = z.infer<typeof UpdateGoalInputSchema>
