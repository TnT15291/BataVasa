import { create } from 'zustand'
import * as db from '@db/settings/queries'
import type { AIProvider } from '@services/ai/providers'
import { LANGUAGE_CURRENCY } from '@services/locale'

export type Language = 'vi' | 'en' | 'zh' | 'ja' | 'ko' | 'fr'
export type ColorMode = 'light' | 'dark' | 'system'
export type ThemeName = 'default' | 'sage' | 'ocean' | 'sunset' | 'midnight'
export type { AIProvider }

type SettingsState = {
  language: Language
  currency: string
  displayCurrency: string
  colorMode: ColorMode
  themeName: ThemeName
  aiProvider: AIProvider
  locationAccess: boolean
  aiAutoConfirm: boolean
  syncFinance: boolean
  syncReminders: boolean
  syncHabits: boolean
  syncJournals: boolean
  hasSeenOnboarding: boolean
  biometricLock: boolean
  loaded: boolean

  loadSettings: () => Promise<void>
  setLanguage: (l: Language) => Promise<void>
  setCurrency: (c: string) => Promise<void>
  setDisplayCurrency: (c: string) => Promise<void>
  setColorMode: (m: ColorMode) => Promise<void>
  setThemeName: (t: ThemeName) => Promise<void>
  setAIProvider: (p: AIProvider) => Promise<void>
  setLocationAccess: (allowed: boolean) => Promise<void>
  setAIAutoConfirm: (enabled: boolean) => Promise<void>
  setSyncFinance: (enabled: boolean) => Promise<void>
  setSyncReminders: (enabled: boolean) => Promise<void>
  setSyncHabits: (enabled: boolean) => Promise<void>
  setSyncJournals: (enabled: boolean) => Promise<void>
  setHasSeenOnboarding: (value: boolean) => Promise<void>
  setBiometricLock: (enabled: boolean) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  language: 'vi',
  currency: 'VND',
  displayCurrency: 'VND',
  colorMode: 'system',
  themeName: 'default',
  aiProvider: 'openai',
  locationAccess: false,
  aiAutoConfirm: true,
  syncFinance: true,
  syncReminders: true,
  syncHabits: true,
  syncJournals: true,
  hasSeenOnboarding: false,
  biometricLock: false,
  loaded: false,

  async loadSettings() {
    const all = await db.getAllSettings()
    const language = (all['language'] as Language) ?? 'vi'
    const currency = all['currency'] ?? LANGUAGE_CURRENCY[language] ?? 'VND'
    set({
      language,
      currency,
      displayCurrency: all['display_currency'] ?? currency,
      colorMode: (all['color_mode'] as ColorMode) ?? 'system',
      themeName: (all['theme_name'] as ThemeName) ?? 'default',
      aiProvider: (all['ai_provider'] as AIProvider) ?? 'openai',
      locationAccess: all['location_access'] === 'true',
      // default true — only false if explicitly stored
      aiAutoConfirm: all['ai_auto_confirm'] !== 'false',
      syncFinance: all['sync_finance'] !== 'false',
      syncReminders: all['sync_reminders'] !== 'false',
      syncHabits: all['sync_habits'] !== 'false',
      syncJournals: all['sync_journals'] !== 'false',
      hasSeenOnboarding: all['has_seen_onboarding'] === 'true',
      biometricLock: all['biometric_lock'] === 'true',
      loaded: true,
    })
  },

  async setHasSeenOnboarding(value) {
    set({ hasSeenOnboarding: value })
    await db.setSetting('has_seen_onboarding', value ? 'true' : 'false')
  },

  async setLanguage(language) {
    const currency = LANGUAGE_CURRENCY[language] ?? 'USD'
    set({ language, currency, displayCurrency: currency })
    await db.setSetting('language', language)
    await db.setSetting('currency', currency)
    await db.setSetting('display_currency', currency)
  },

  async setCurrency(currency) {
    set({ currency })
    await db.setSetting('currency', currency)
  },

  async setDisplayCurrency(displayCurrency) {
    set({ displayCurrency })
    await db.setSetting('display_currency', displayCurrency)
  },

  async setColorMode(colorMode) {
    set({ colorMode })
    await db.setSetting('color_mode', colorMode)
  },

  async setThemeName(themeName) {
    set({ themeName })
    await db.setSetting('theme_name', themeName)
  },

  async setAIProvider(aiProvider) {
    set({ aiProvider })
    await db.setSetting('ai_provider', aiProvider)
  },

  async setLocationAccess(allowed) {
    set({ locationAccess: allowed })
    await db.setSetting('location_access', allowed ? 'true' : 'false')
  },

  async setAIAutoConfirm(enabled) {
    set({ aiAutoConfirm: enabled })
    await db.setSetting('ai_auto_confirm', enabled ? 'true' : 'false')
  },

  async setSyncFinance(enabled) {
    set({ syncFinance: enabled })
    await db.setSetting('sync_finance', enabled ? 'true' : 'false')
  },

  async setSyncReminders(enabled) {
    set({ syncReminders: enabled })
    await db.setSetting('sync_reminders', enabled ? 'true' : 'false')
  },

  async setSyncHabits(enabled) {
    set({ syncHabits: enabled })
    await db.setSetting('sync_habits', enabled ? 'true' : 'false')
  },

  async setSyncJournals(enabled) {
    set({ syncJournals: enabled })
    await db.setSetting('sync_journals', enabled ? 'true' : 'false')
  },

  async setBiometricLock(enabled) {
    set({ biometricLock: enabled })
    await db.setSetting('biometric_lock', enabled ? 'true' : 'false')
  },
}))
