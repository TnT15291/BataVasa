import {
  GoalMetricBindingSchema,
  CreateGoalInputSchema,
} from '../features/goals/types'

describe('GoalMetricBindingSchema', () => {
  it('accepts a finance sum_amount binding', () => {
    const r = GoalMetricBindingSchema.safeParse({
      module: 'finance',
      aggregation: 'sum_amount',
      category_id: 'sys_food_groceries',
    })
    expect(r.success).toBe(true)
  })

  it('accepts a habits completion_rate binding', () => {
    const r = GoalMetricBindingSchema.safeParse({
      module: 'habits',
      aggregation: 'completion_rate',
      habit_id: 'h-1',
    })
    expect(r.success).toBe(true)
  })

  it('rejects an unknown module and missing ids', () => {
    expect(GoalMetricBindingSchema.safeParse({ module: 'journals' }).success).toBe(false)
    expect(GoalMetricBindingSchema.safeParse({ module: 'finance', aggregation: 'sum_amount', category_id: '' }).success).toBe(false)
    expect(GoalMetricBindingSchema.safeParse({ module: 'habits', aggregation: 'completion_rate' }).success).toBe(false)
  })
})

describe('CreateGoalInputSchema', () => {
  const valid = {
    title: 'Save 50M',
    target_type: 'amount' as const,
    target_value: 50_000_000,
    unit: 'VND',
    start_date: '2026-01-01',
    metric_binding: { module: 'finance' as const, aggregation: 'sum_amount' as const, category_id: 'sys_emergency_fund' },
  }

  it('accepts a well-formed goal', () => {
    expect(CreateGoalInputSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects a non-positive target', () => {
    expect(CreateGoalInputSchema.safeParse({ ...valid, target_value: 0 }).success).toBe(false)
  })

  it('rejects an empty title', () => {
    expect(CreateGoalInputSchema.safeParse({ ...valid, title: '' }).success).toBe(false)
  })
})
