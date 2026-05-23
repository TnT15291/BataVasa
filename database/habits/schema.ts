import type { SQLiteDatabase } from 'expo-sqlite'

export async function createHabitSchema(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS habit (
      id              TEXT PRIMARY KEY NOT NULL,
      user_id         TEXT,
      name            TEXT NOT NULL,
      icon            TEXT NOT NULL DEFAULT '✅',
      color           TEXT NOT NULL DEFAULT '#4CAF50',
      cadence         TEXT NOT NULL DEFAULT 'daily',
      target_per_period INTEGER NOT NULL DEFAULT 1,
      schedule_days   TEXT,
      location_lat    REAL,
      location_lng    REAL,
      location_label  TEXT,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL,
      deleted_at      TEXT,
      synced_at       TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_habit_user
      ON habit (user_id) WHERE deleted_at IS NULL;

    CREATE TABLE IF NOT EXISTS habit_log (
      id          TEXT PRIMARY KEY NOT NULL,
      habit_id    TEXT NOT NULL,
      user_id     TEXT,
      occurred_at TEXT NOT NULL,
      note        TEXT,
      skipped     INTEGER NOT NULL DEFAULT 0 CHECK (skipped IN (0,1)),
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      deleted_at  TEXT,
      synced_at   TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_habit_log_habit_date
      ON habit_log (habit_id, occurred_at) WHERE deleted_at IS NULL;
  `)
}
