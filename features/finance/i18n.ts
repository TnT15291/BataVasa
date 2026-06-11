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
  'Learning Fund': 'cat_learning_fund',
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

/**
 * Match an AI-returned category_hint to a category from the list.
 * Priority: exact English DB name → exact translated name → substring fallback.
 * AI is instructed to return exact English names, but this guards against
 * the model returning a translated or paraphrased name.
 */
export function matchCategory(
  cats: Category[],
  hint: string,
  t: Translations
): Category | undefined {
  const h = hint.toLowerCase().trim()
  if (!h) return undefined

  // 1. Exact English DB name (fast path — AI prompt asks for this)
  let found = cats.find((c) => c.name.toLowerCase() === h)
  if (found) return found

  // 2. Exact translated name in the active language
  found = cats.find((c) => translateCategoryName(c, t).toLowerCase() === h)
  if (found) return found

  // 3. English DB name contains hint, or hint contains DB name
  found = cats.find((c) => {
    const en = c.name.toLowerCase()
    return en.includes(h) || h.includes(en)
  })
  if (found) return found

  // 4. Translated name contains hint, or hint contains translated name
  found = cats.find((c) => {
    const tn = translateCategoryName(c, t).toLowerCase()
    return tn.includes(h) || h.includes(tn)
  })
  return found
}
