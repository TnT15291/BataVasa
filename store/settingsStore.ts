import { create } from 'zustand'
import * as db from '@db/settings/queries'
import { logger } from '@services/logger'
import { LANGUAGE_CURRENCY } from '@services/locale'
import {
  clampWeekday,
  clampHour,
  DEFAULT_WEEKLY_REVIEW_DAY,
  DEFAULT_WEEKLY_REVIEW_HOUR,
} from '@services/proactiveSchedule'

export type Language = 'vi' | 'en' | 'zh' | 'ja' | 'ko' | 'fr'
export type ColorMode = 'light' | 'dark' | 'system'
export type ThemeName = 'default' | 'sage' | 'ocean' | 'sunset' | 'midnight'

type SettingsState = {
  language: Language
  currency: string
  displayCurrency: string
  /** True once the user has deliberately picked a currency — stops `setLanguage` from re-seeding it. */
  currencyExplicit: boolean
  colorMode: ColorMode
  themeName: ThemeName
  locationAccess: boolean
  /** Allow BataVasa to send reminder/habit notifications. Off = schedule nothing. */
  notificationAccess: boolean
  aiAutoConfirm: boolean
  syncFinance: boolean
  syncReminders: boolean
  syncHabits: boolean
  syncJournals: boolean
  syncGoals: boolean
  syncContext: boolean
  hasSeenOnboarding: boolean
  biometricLock: boolean
  hideJournals: boolean
  hideMicPermissionPrompt: boolean
  /** Day of month (1-28) the budget cycle starts — e.g. 25 for a salary paid on the 25th. */
  financeCycleStartDay: number
  /** Count expected (not-yet-received) income in Safe to spend. Off = only spend money you hold. */
  safeToSpendCountPlannedIncome: boolean
  /** Roll the previous cycle's leftover into this cycle's Safe to spend. Default off. */
  safeToSpendCarryOver: boolean
  /** Opt-in weekly notification nudging the user to read their Weekly Life Review. */
  proactiveWeeklyReview: boolean
  /** Weekly review notification day (expo weekday: 1=Sunday … 7=Saturday). */
  proactiveWeeklyDay: number
  /** Weekly review notification hour (0-23, local). */
  proactiveWeeklyHour: number
  /** Opt-in yearly nudge on the anniversary of important journal entries ("on this day"). */
  anniversaryReminders: boolean
  loaded: boolean

  loadSettings: () => Promise<void>
  setLanguage: (l: Language) => Promise<void>
  setCurrency: (c: string) => Promise<void>
  setDisplayCurrency: (c: string) => Promise<void>
  setColorMode: (m: ColorMode) => Promise<void>
  setThemeName: (t: ThemeName) => Promise<void>
  setLocationAccess: (allowed: boolean) => Promise<void>
  setNotificationAccess: (allowed: boolean) => Promise<void>
  setAIAutoConfirm: (enabled: boolean) => Promise<void>
  setSyncFinance: (enabled: boolean) => Promise<void>
  setSyncReminders: (enabled: boolean) => Promise<void>
  setSyncHabits: (enabled: boolean) => Promise<void>
  setSyncJournals: (enabled: boolean) => Promise<void>
  setSyncGoals: (enabled: boolean) => Promise<void>
  setSyncContext: (enabled: boolean) => Promise<void>
  setHasSeenOnboarding: (value: boolean) => Promise<void>
  setBiometricLock: (enabled: boolean) => Promise<void>
  setHideJournals: (enabled: boolean) => Promise<void>
  setHideMicPermissionPrompt: (hidden: boolean) => Promise<void>
  setFinanceCycleStartDay: (day: number) => Promise<void>
  setSafeToSpendCountPlannedIncome: (enabled: boolean) => Promise<void>
  setSafeToSpendCarryOver: (enabled: boolean) => Promise<void>
  setProactiveWeeklyReview: (enabled: boolean) => Promise<void>
  setProactiveWeeklyDay: (day: number) => Promise<void>
  setProactiveWeeklyHour: (hour: number) => Promise<void>
  setAnniversaryReminders: (enabled: boolean) => Promise<void>
}

function clampCycleDay(day: number): number {
  if (!Number.isFinite(day)) return 1
  return Math.min(28, Math.max(1, Math.round(day)))
}

// Persist one setting. The in-memory value is already updated by the caller, so a
// storage failure must not throw out of the setter or surface as an unhandled
// rejection — log it and move on.
async function persist(key: string, value: string): Promise<void> {
  try {
    await db.setSetting(key, value)
  } catch (e) {
    logger.error('settings.store', 'failed to persist setting', { key, error: String(e) })
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  language: 'vi',
  currency: 'VND',
  displayCurrency: 'VND',
  currencyExplicit: false,
  colorMode: 'system',
  themeName: 'default',
  locationAccess: false,
  notificationAccess: true,
  aiAutoConfirm: true,
  syncFinance: true,
  syncReminders: true,
  syncHabits: true,
  syncJournals: true,
  syncGoals: true,
  syncContext: true,
  hasSeenOnboarding: false,
  biometricLock: false,
  hideJournals: false,
  hideMicPermissionPrompt: false,
  financeCycleStartDay: 1,
  safeToSpendCountPlannedIncome: true,
  safeToSpendCarryOver: false,
  proactiveWeeklyReview: false,
  proactiveWeeklyDay: DEFAULT_WEEKLY_REVIEW_DAY,
  proactiveWeeklyHour: DEFAULT_WEEKLY_REVIEW_HOUR,
  anniversaryReminders: false,
  loaded: false,

  async loadSettings() {
    const all = await db.getAllSettings()
    const language = (all['language'] as Language) ?? 'vi'
    const currency = all['currency'] ?? LANGUAGE_CURRENCY[language] ?? 'VND'
    const displayCurrency = all['display_currency'] ?? currency
    // Infer "explicit" for users who picked a currency before this flag existed:
    // if their currency diverges from the language default, it must have been a deliberate choice.
    const currencyExplicit =
      all['currency_explicit'] === 'true' ||
      currency !== (LANGUAGE_CURRENCY[language] ?? currency) ||
      displayCurrency !== currency
    set({
      language,
      currency,
      displayCurrency,
      currencyExplicit,
      colorMode: (all['color_mode'] as ColorMode) ?? 'system',
      themeName: (all['theme_name'] as ThemeName) ?? 'default',
      locationAccess: all['location_access'] === 'true',
      // default true — only false if explicitly stored (so reminders notify by default)
      notificationAccess: all['notification_access'] !== 'false',
      // default true — only false if explicitly stored
      aiAutoConfirm: all['ai_auto_confirm'] !== 'false',
      syncFinance: all['sync_finance'] !== 'false',
      syncReminders: all['sync_reminders'] !== 'false',
      syncHabits: all['sync_habits'] !== 'false',
      syncJournals: all['sync_journals'] !== 'false',
      syncGoals: all['sync_goals'] !== 'false',
      syncContext: all['sync_context'] !== 'false',
      hasSeenOnboarding: all['has_seen_onboarding'] === 'true',
      biometricLock: all['biometric_lock'] === 'true',
      hideJournals: all['hide_journals'] === 'true',
      hideMicPermissionPrompt: all['hide_mic_permission_prompt'] === 'true',
      financeCycleStartDay: clampCycleDay(Number(all['finance_cycle_start_day'] ?? '1')),
      // default true — only false if explicitly stored
      safeToSpendCountPlannedIncome: all['safe_to_spend_count_planned_income'] !== 'false',
      // default false — only true if explicitly stored
      safeToSpendCarryOver: all['safe_to_spend_carry_over'] === 'true',
      // default false (opt-in, calm) — only true if explicitly stored
      proactiveWeeklyReview: all['proactive_weekly_review'] === 'true',
      proactiveWeeklyDay: clampWeekday(Number(all['proactive_weekly_day'] ?? String(DEFAULT_WEEKLY_REVIEW_DAY))),
      proactiveWeeklyHour: clampHour(Number(all['proactive_weekly_hour'] ?? String(DEFAULT_WEEKLY_REVIEW_HOUR))),
      // default false (opt-in, calm) — only true if explicitly stored
      anniversaryReminders: all['anniversary_reminders'] === 'true',
      loaded: true,
    })
  },

  async setHasSeenOnboarding(value) {
    set({ hasSeenOnboarding: value })
    await persist('has_seen_onboarding', value ? 'true' : 'false')
  },

  async setLanguage(language) {
    await persist('language', language)
    // Only seed currency from the language while the user hasn't picked one yet
    // (first-run / onboarding). Never clobber a deliberate currency choice.
    if (get().currencyExplicit) {
      set({ language })
      return
    }
    const currency = LANGUAGE_CURRENCY[language] ?? 'USD'
    set({ language, currency, displayCurrency: currency })
    await persist('currency', currency)
    await persist('display_currency', currency)
  },

  async setCurrency(currency) {
    set({ currency, currencyExplicit: true })
    await persist('currency', currency)
    await persist('currency_explicit', 'true')
  },

  async setDisplayCurrency(displayCurrency) {
    set({ displayCurrency, currencyExplicit: true })
    await persist('display_currency', displayCurrency)
    await persist('currency_explicit', 'true')
  },

  async setColorMode(colorMode) {
    set({ colorMode })
    await persist('color_mode', colorMode)
  },

  async setThemeName(themeName) {
    set({ themeName })
    await persist('theme_name', themeName)
  },

  async setLocationAccess(allowed) {
    set({ locationAccess: allowed })
    await persist('location_access', allowed ? 'true' : 'false')
  },

  async setNotificationAccess(allowed) {
    set({ notificationAccess: allowed })
    await persist('notification_access', allowed ? 'true' : 'false')
  },

  async setAIAutoConfirm(enabled) {
    set({ aiAutoConfirm: enabled })
    await persist('ai_auto_confirm', enabled ? 'true' : 'false')
  },

  async setSyncFinance(enabled) {
    set({ syncFinance: enabled })
    await persist('sync_finance', enabled ? 'true' : 'false')
  },

  async setSyncReminders(enabled) {
    set({ syncReminders: enabled })
    await persist('sync_reminders', enabled ? 'true' : 'false')
  },

  async setSyncHabits(enabled) {
    set({ syncHabits: enabled })
    await persist('sync_habits', enabled ? 'true' : 'false')
  },

  async setSyncJournals(enabled) {
    set({ syncJournals: enabled })
    await persist('sync_journals', enabled ? 'true' : 'false')
  },

  async setSyncGoals(enabled) {
    set({ syncGoals: enabled })
    await persist('sync_goals', enabled ? 'true' : 'false')
  },

  async setSyncContext(enabled) {
    set({ syncContext: enabled })
    await persist('sync_context', enabled ? 'true' : 'false')
  },

  async setBiometricLock(enabled) {
    set({ biometricLock: enabled })
    await persist('biometric_lock', enabled ? 'true' : 'false')
  },

  async setHideJournals(enabled) {
    set({ hideJournals: enabled })
    await persist('hide_journals', enabled ? 'true' : 'false')
  },

  async setHideMicPermissionPrompt(hidden) {
    set({ hideMicPermissionPrompt: hidden })
    await persist('hide_mic_permission_prompt', hidden ? 'true' : 'false')
  },

  async setFinanceCycleStartDay(day) {
    const clamped = clampCycleDay(day)
    set({ financeCycleStartDay: clamped })
    await persist('finance_cycle_start_day', String(clamped))
  },

  async setSafeToSpendCountPlannedIncome(enabled) {
    set({ safeToSpendCountPlannedIncome: enabled })
    await persist('safe_to_spend_count_planned_income', enabled ? 'true' : 'false')
  },

  async setSafeToSpendCarryOver(enabled) {
    set({ safeToSpendCarryOver: enabled })
    await persist('safe_to_spend_carry_over', enabled ? 'true' : 'false')
  },

  async setProactiveWeeklyReview(enabled) {
    set({ proactiveWeeklyReview: enabled })
    await persist('proactive_weekly_review', enabled ? 'true' : 'false')
  },

  async setProactiveWeeklyDay(day) {
    const clamped = clampWeekday(day)
    set({ proactiveWeeklyDay: clamped })
    await persist('proactive_weekly_day', String(clamped))
  },

  async setProactiveWeeklyHour(hour) {
    const clamped = clampHour(hour)
    set({ proactiveWeeklyHour: clamped })
    await persist('proactive_weekly_hour', String(clamped))
  },

  async setAnniversaryReminders(enabled) {
    set({ anniversaryReminders: enabled })
    await persist('anniversary_reminders', enabled ? 'true' : 'false')
  },
}))
