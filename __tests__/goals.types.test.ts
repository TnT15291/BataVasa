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
  const measure = {
    binding: { module: 'finance' as const, aggregation: 'sum_amount' as const, category_id: 'sys_emergency_fund' },
    target_type: 'amount' as const,
    target_value: 50_000_000,
    unit: 'VND',
    direction: 'reach' as const,
  }
  const valid = {
    title: 'Save 50M',
    start_date: '2026-01-01',
    measures: [measure],
  }

  it('accepts a well-formed goal', () => {
    expect(CreateGoalInputSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts several measures at once', () => {
    const habit = { binding: { module: 'habits' as const, aggregation: 'completion_rate' as const, habit_id: 'h-1' }, target_type: 'rate' as const, target_value: 100, unit: '%' as const }
    expect(CreateGoalInputSchema.safeParse({ ...valid, measures: [measure, habit] }).success).toBe(true)
  })

  it('rejects a goal with no measures', () => {
    expect(CreateGoalInputSchema.safeParse({ ...valid, measures: [] }).success).toBe(false)
  })

  it('rejects a non-positive target', () => {
    expect(CreateGoalInputSchema.safeParse({ ...valid, measures: [{ ...measure, target_value: 0 }] }).success).toBe(false)
  })

  it('rejects an empty title', () => {
    expect(CreateGoalInputSchema.safeParse({ ...valid, title: '' }).success).toBe(false)
  })
})
