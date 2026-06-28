import { z } from 'zod'

export const GoalStatusSchema = z.enum(['active', 'paused', 'done', 'archived'])
export type GoalStatus = z.infer<typeof GoalStatusSchema>

export const GoalTargetTypeSchema = z.enum(['amount', 'rate', 'count'])
export type GoalTargetType = z.infer<typeof GoalTargetTypeSchema>

// 'reach' = accumulate up TO the target (save 50M, hit 100%); progress = current/target.
// 'cap'   = stay UNDER a ceiling (dining < 2M); the same fill now means budget used,
//           and exceeding the target is a failure, not progress.
export const GoalDirectionSchema = z.enum(['reach', 'cap'])
export type GoalDirection = z.infer<typeof GoalDirectionSchema>

export const GoalMetricBindingSchema = z.discriminatedUnion('module', [
  z.object({
    module: z.literal('finance'),
    aggregation: z.literal('sum_amount'),
    category_id: z.string().min(1),
    kind: z.enum(['income', 'expense', 'savings']).optional(),
  }),
  z.object({
    module: z.literal('habits'),
    // completion_rate = % of scheduled days hit (target is a percent);
    // completion_count = total completed days in range (target is a count).
    aggregation: z.enum(['completion_rate', 'completion_count']),
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

// A goal can be measured by several actions across modules at once (e.g. "save
// 50M" + "exercise 100%"). Each measure carries its own target/unit/direction.
// The JSON `measures` array on the goal is the source of truth; the legacy
// single columns mirror measures[0] for backward-compatible reads.
export const GoalMeasureSchema = z.object({
  binding: GoalMetricBindingSchema,
  target_type: GoalTargetTypeSchema,
  target_value: z.number().positive(),
  unit: z.string().min(1).max(24),
  direction: GoalDirectionSchema.default('reach'),
})
export type GoalMeasure = z.infer<typeof GoalMeasureSchema>
export type GoalMeasureInput = z.input<typeof GoalMeasureSchema>

export type Goal = {
  id: string
  user_id: string | null
  title: string
  description: string | null
  target_type: GoalTargetType
  target_value: number
  unit: string
  direction: GoalDirection
  start_date: string
  due_date: string | null
  metric_binding: string
  // JSON array of GoalMeasure. Null on goals created before multi-measure; those
  // fall back to a single measure derived from the legacy columns above.
  measures: string | null
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
  direction: GoalDirection
  // reached = a 'reach' goal hit its target; over = a 'cap' goal exceeded its
  // ceiling; on_track = everything else (still climbing, or still under the cap).
  status: 'on_track' | 'reached' | 'over'
  // Optional secondary detail (e.g. average mood for journal-area goals).
  note?: string
}

export type GoalMeasureProgress = {
  binding: GoalMetricBinding
  progress: GoalProgress
}

export type GoalWithProgress = Goal & {
  // Primary measure binding (measures[0]) — kept for backward-compatible reads
  // (list card icon, AI context, digest). Null only on a corrupt/empty goal.
  binding: GoalMetricBinding | null
  // Aggregate across all measures: percent = lowest measure, done when every
  // 'reach' measure is reached. Drives the ring + list card.
  progress: GoalProgress
  // Each measure's own binding + progress, for the detail breakdown.
  measureProgress: GoalMeasureProgress[]
}

export const CreateGoalInputSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  start_date: z.string().min(10).max(30),
  due_date: z.string().min(10).max(30).nullable().optional(),
  // At least one measure; the first is the primary mirrored into legacy columns.
  measures: z.array(GoalMeasureSchema).min(1).max(8),
})
// z.input (not z.infer) so callers may omit each measure's `direction` — the
// schema defaults it to 'reach' on parse.
export type CreateGoalInput = z.input<typeof CreateGoalInputSchema>

export const UpdateGoalInputSchema = CreateGoalInputSchema.partial().extend({
  id: z.string().uuid(),
  status: GoalStatusSchema.optional(),
})
// z.input so callers may omit each measure's `direction` (defaulted on parse),
// matching CreateGoalInput.
export type UpdateGoalInput = z.input<typeof UpdateGoalInputSchema>
