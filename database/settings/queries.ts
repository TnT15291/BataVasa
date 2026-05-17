import { getDb, nowIso } from '@db/core/db'

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb()
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    [key]
  )
  return row?.value ?? null
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    `INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)`,
    [key, value, nowIso()]
  )
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const db = await getDb()
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM app_settings'
  )
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}
