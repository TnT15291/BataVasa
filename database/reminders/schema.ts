import type { SQLiteDatabase } from 'expo-sqlite'

export async function createReminderSchema(db: SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS reminder (
      id           TEXT PRIMARY KEY NOT NULL,
      user_id      TEXT,
      title        TEXT NOT NULL,
      note         TEXT,
      remind_at    TEXT NOT NULL,
      recurrence   TEXT NOT NULL DEFAULT 'none'
                   CHECK (recurrence IN ('none','daily','weekly','monthly')),
      priority     TEXT NOT NULL DEFAULT 'medium'
                   CHECK (priority IN ('low','medium','high')),
      is_inbox     INTEGER NOT NULL DEFAULT 0 CHECK (is_inbox IN (0,1)),
      completed    INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0,1)),
      location_lat  REAL,
      location_lng  REAL,
      location_label TEXT,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL,
      deleted_at   TEXT,
      synced_at    TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_reminder_remind_at
      ON reminder (user_id, remind_at) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_reminder_completed
      ON reminder (user_id, completed) WHERE deleted_at IS NULL;
  `)
}
