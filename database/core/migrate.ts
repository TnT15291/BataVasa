import type { SQLiteDatabase } from 'expo-sqlite'
import { getDb } from './db'
import { initFinanceSchema } from '../finance/schema'
import { initSettingsSchema } from '../settings/schema'
import { createReminderSchema } from '../reminders/schema'
import { createJournalSchema } from '../journals/schema'
import { createHabitSchema } from '../habits/schema'
import { createSyncQueueSchema } from '../sync/schema'
import { logger } from '@services/logger'

// Each entry creates one schema version. user_version starts at 0 (fresh DB)
// and increments by 1 per applied migration.
const MIGRATIONS: Array<(db: SQLiteDatabase) => Promise<void>> = [
  // v1 — initial schemas (idempotent CREATE IF NOT EXISTS)
  async (db) => {
    await initFinanceSchema(db)
    await initSettingsSchema(db)
  },
  // v2 — location columns on finance_transaction (Cross-Module Rule 6)
  async (db) => {
    await safeAddColumn(db, 'finance_transaction', 'location_lat', 'REAL')
    await safeAddColumn(db, 'finance_transaction', 'location_lng', 'REAL')
    await safeAddColumn(db, 'finance_transaction', 'location_label', 'TEXT')
  },
  // v3 — monthly budget per category (M17)
  async (db) => {
    await safeAddColumn(db, 'finance_category', 'monthly_budget_cents', 'INTEGER')
  },
  // v4 — reminders module
  async (db) => {
    await createReminderSchema(db)
  },
  // v5 — journals module
  async (db) => {
    await createJournalSchema(db)
  },
  // v6 — habits module
  async (db) => {
    await createHabitSchema(db)
  },
  // v7 — advance_minutes on reminder (remind X minutes before the event)
  async (db) => {
    await safeAddColumn(db, 'reminder', 'advance_minutes', 'INTEGER NOT NULL DEFAULT 0')
  },
  // v8 — sync_queue table for offline-first cloud sync
  async (db) => {
    await createSyncQueueSchema(db)
  },
  // v9 - P0 product fields
  async (db) => {
    await safeAddColumn(db, 'journal', 'is_important', 'INTEGER NOT NULL DEFAULT 0')
    await safeAddColumn(db, 'reminder', 'priority', "TEXT NOT NULL DEFAULT 'medium'")
    await safeAddColumn(db, 'habit_log', 'skipped', 'INTEGER NOT NULL DEFAULT 0')
    await safeAddColumn(db, 'finance_transaction', 'needs_review', 'INTEGER NOT NULL DEFAULT 0')
    await safeAddColumn(db, 'finance_transaction', 'review_reason', 'TEXT')
  },
  // v10 - finance merchant/category rules
  async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS finance_rule (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT,
        merchant_pattern TEXT NOT NULL,
        category_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        synced_at TEXT,
        FOREIGN KEY (category_id) REFERENCES finance_category(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_rule_merchant ON finance_rule(merchant_pattern) WHERE deleted_at IS NULL;
    `)
  },
  // v11 - reminder inbox items
  async (db) => {
    await safeAddColumn(db, 'reminder', 'is_inbox', 'INTEGER NOT NULL DEFAULT 0')
  },
  // v12 - custom habit schedules
  async (db) => {
    await safeAddColumn(db, 'habit', 'schedule_days', 'TEXT')
  },
]

async function safeAddColumn(
  db: SQLiteDatabase,
  table: string,
  column: string,
  type: string
): Promise<void> {
  try {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`)
  } catch (e) {
    // SQLite throws if column exists. Ignore — idempotent migration.
    const msg = String(e)
    if (!msg.includes('duplicate column')) throw e
  }
}

let migrationPromise: Promise<void> | null = null

export function runMigrations(): Promise<void> {
  if (migrationPromise) return migrationPromise
  migrationPromise = doMigrate()
  return migrationPromise
}

async function doMigrate(): Promise<void> {
  const db = await getDb()
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version')
  const current = row?.user_version ?? 0
  for (let i = current; i < MIGRATIONS.length; i++) {
    await MIGRATIONS[i]!(db)
    await db.execAsync(`PRAGMA user_version = ${i + 1}`)
    logger.info('migrate', `applied v${i + 1}`)
  }
}
