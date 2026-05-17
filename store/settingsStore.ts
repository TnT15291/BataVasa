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
  colorMode: ColorMode
  themeName: ThemeName
  aiProvider: AIProvider
  loaded: boolean

  loadSettings: () => Promise<void>
  setLanguage: (l: Language) => Promise<void>
  setCurrency: (c: string) => Promise<void>
  setColorMode: (m: ColorMode) => Promise<void>
  setThemeName: (t: ThemeName) => Promise<void>
  setAIProvider: (p: AIProvider) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  language: 'vi',
  currency: 'VND',
  colorMode: 'system',
  themeName: 'default',
  aiProvider: 'openai',
  loaded: false,

  async loadSettings() {
    const all = await db.getAllSettings()
    const language = (all['language'] as Language) ?? 'vi'
    const currency = all['currency'] ?? LANGUAGE_CURRENCY[language] ?? 'VND'
    set({
      language,
      currency,
      colorMode: (all['color_mode'] as ColorMode) ?? 'system',
      themeName: (all['theme_name'] as ThemeName) ?? 'default',
      aiProvider: (all['ai_provider'] as AIProvider) ?? 'openai',
      loaded: true,
    })
  },

  async setLanguage(language) {
    const currency = LANGUAGE_CURRENCY[language] ?? 'USD'
    set({ language, currency })
    await db.setSetting('language', language)
    await db.setSetting('currency', currency)
  },

  async setCurrency(currency) {
    set({ currency })
    await db.setSetting('currency', currency)
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
}))
