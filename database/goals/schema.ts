import type { SQLiteDatabase } from 'expo-sqlite'

export async function createGoalSchema(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS goal (
      id              TEXT PRIMARY KEY NOT NULL,
      user_id         TEXT,
      title           TEXT NOT NULL,
      description     TEXT,
      target_type     TEXT NOT NULL CHECK (target_type IN ('amount','rate','count')),
      target_value    REAL NOT NULL CHECK (target_value > 0),
      unit            TEXT NOT NULL,
      start_date      TEXT NOT NULL,
      due_date        TEXT,
      metric_binding  TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','done','archived')),
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL,
      deleted_at      TEXT,
      synced_at       TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_goal_user_status
      ON goal (user_id, status, due_date)
      WHERE deleted_at IS NULL;
  `)
}
