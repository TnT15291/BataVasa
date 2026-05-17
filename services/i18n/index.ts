import { useSettingsStore, type Language } from '@store/settingsStore'
import { vi } from './translations/vi'
import { en } from './translations/en'
import { zh } from './translations/zh'
import { ja } from './translations/ja'
import { ko } from './translations/ko'
import { fr } from './translations/fr'
import type { Translations } from './translations/vi'

export type { Language, Translations }

const map: Record<Language, Translations> = { vi, en, zh, ja, ko, fr }

export const LANGUAGES: Array<{ code: Language; nativeLabel: string; flag: string }> = [
  { code: 'vi', nativeLabel: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', nativeLabel: 'English', flag: '🇬🇧' },
  { code: 'zh', nativeLabel: '中文', flag: '🇨🇳' },
  { code: 'ja', nativeLabel: '日本語', flag: '🇯🇵' },
  { code: 'ko', nativeLabel: '한국어', flag: '🇰🇷' },
  { code: 'fr', nativeLabel: 'Français', flag: '🇫🇷' },
]

export function useTranslation() {
  const language = useSettingsStore((s) => s.language)
  const t = map[language] ?? vi
  return { t, language }
}
