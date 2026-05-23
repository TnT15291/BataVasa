import type { SQLiteDatabase } from 'expo-sqlite'

export async function createJournalSchema(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS journal (
      id              TEXT PRIMARY KEY NOT NULL,
      user_id         TEXT,
      content         TEXT NOT NULL,
      mood            INTEGER,
      is_important    INTEGER NOT NULL DEFAULT 0,
      occurred_at     TEXT NOT NULL,
      location_lat    REAL,
      location_lng    REAL,
      location_label  TEXT,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL,
      deleted_at      TEXT,
      synced_at       TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_journal_occurred_at
      ON journal (user_id, occurred_at) WHERE deleted_at IS NULL;
  `)
}
