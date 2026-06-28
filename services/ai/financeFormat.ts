import { getTranslations } from '@services/i18n'
import { getIntlLocale } from '@services/locale'
import { useSettingsStore } from '@store/settingsStore'
import { translateCategoryName, isDebtCategoryName } from '@features/finance/i18n'
import type { Category } from '@features/finance/types'

// Loan movement (lent out / borrowed), tracked in the debt book — never real
// consumption. Exclude from spending-behavior analysis (top categories,
// merchants, day/time patterns) so a lender/borrower never reads as a "spender".
export function isDebtCategory(cat: Category | undefined): boolean {
  return isDebtCategoryName(cat?.name)
}

export function isIncomeCategory(cat: Category | undefined): boolean {
  return cat?.kind === 'income'
}

/**
 * Category label for AI prompts: translated into the active language so the
 * model never echoes English seed names (Housing, Salary, …) into a non-English
 * report. Missing category (orphaned transaction) falls back to "Other".
 */
export function aiCategoryName(cat: Category | undefined): string {
  return cat ? translateCategoryName(cat, getTranslations()) : 'Other'
}

/**
 * Short weekday names in the active language, index 0=Sunday … 6=Saturday, so
 * day-of-week data fed to the AI is already localized (no English "Wed" leak).
 */
export function localizedShortWeekdays(): string[] {
  const locale = getIntlLocale(useSettingsStore.getState().language)
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  // 2023-01-01 (UTC) was a Sunday → produces Sun..Sat in order.
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2023, 0, 1 + i))))
}
