import type { Category, CategoryKind } from './types'
import type { Translations } from '@services/i18n/translations/vi'

// English seed name → translation key. Source of truth: database/finance/schema.ts SYSTEM_CATEGORIES.
const SYSTEM_CATEGORY_KEY: Record<string, keyof Translations> = {
  'Food & Groceries': 'cat_food_groceries',
  'Transport': 'cat_transport',
  'Housing': 'cat_housing',
  'Utilities': 'cat_utilities',
  'Healthcare': 'cat_healthcare',
  'Dining Out': 'cat_dining_out',
  'Entertainment': 'cat_entertainment',
  'Shopping': 'cat_shopping',
  'Subscriptions': 'cat_subscriptions',
  'Salary': 'cat_salary',
  'Freelance': 'cat_freelance',
  'Other Income': 'cat_other_income',
  'Emergency Fund': 'cat_emergency_fund',
  'Investments': 'cat_investments',
}

const KIND_KEY: Record<CategoryKind, keyof Translations> = {
  essential: 'kind_essential',
  discretionary: 'kind_discretionary',
  income: 'kind_income',
  savings: 'kind_savings',
}

// System rows have user_id === null and their name matches a known seed.
// User-custom rows return their name as-is.
export function translateCategoryName(category: Category, t: Translations): string {
  if (category.user_id == null) {
    const key = SYSTEM_CATEGORY_KEY[category.name]
    if (key) return t[key]
  }
  return category.name
}

export function translateKind(kind: CategoryKind, t: Translations): string {
  return t[KIND_KEY[kind]]
}
