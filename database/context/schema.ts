import type { SQLiteDatabase } from 'expo-sqlite'

// user_context = the AI memory layer. Each row is one short, stable fact the
// user wants the assistant to remember (a goal, a preference, or a plain fact).
// Injected into generative AI system prompts so insights/reviews/chat are
// personalized instead of stateless. Follows Cross-Module Rule 1 (sync/export/wipe).
export async function createContextSchema(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS user_context (
      id          TEXT PRIMARY KEY NOT NULL,
      user_id     TEXT,
      kind        TEXT NOT NULL DEFAULT 'fact' CHECK (kind IN ('goal','preference','fact')),
      content     TEXT NOT NULL,
      pinned      INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      deleted_at  TEXT,
      synced_at   TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_user_context_user
      ON user_context (user_id) WHERE deleted_at IS NULL;
  `)
}
