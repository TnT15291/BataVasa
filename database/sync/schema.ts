import type { SQLiteDatabase } from 'expo-sqlite'

export async function createSyncQueueSchema(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id          TEXT PRIMARY KEY NOT NULL,
      table_name  TEXT NOT NULL,
      row_id      TEXT NOT NULL,
      operation   TEXT NOT NULL CHECK (operation IN ('upsert', 'wipe')),
      created_at  TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error  TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_queue_dedup
      ON sync_queue (table_name, row_id) WHERE operation = 'upsert';
  `)
}
