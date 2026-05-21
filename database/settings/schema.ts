import type { SQLiteDatabase } from 'expo-sqlite'
import { nowIso } from '@db/core/db'
import { getDeviceLanguage, LANGUAGE_CURRENCY } from '@services/locale'

const CREATE_SETTINGS_SQL = `
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`

export async function initSettingsSchema(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(CREATE_SETTINGS_SQL)
  const lang = getDeviceLanguage()
  const currency = LANGUAGE_CURRENCY[lang] ?? 'USD'
  const ts = nowIso()
  const defaults = [
    { key: 'language', value: lang },
    { key: 'currency', value: currency },
    { key: 'color_mode', value: 'system' },
    { key: 'theme_name', value: 'default' },
    { key: 'ai_provider', value: 'openai' },
    { key: 'has_seen_onboarding', value: 'false' },
  ]
  for (const s of defaults) {
    await db.runAsync(
      `INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)`,
      [s.key, s.value, ts]
    )
  }
}
