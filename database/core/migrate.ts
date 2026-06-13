import type { SQLiteDatabase } from 'expo-sqlite'
import { getDb } from './db'
import { initFinanceSchema } from '../finance/schema'
import { initSettingsSchema } from '../settings/schema'
import { createReminderSchema } from '../reminders/schema'
import { createJournalSchema } from '../journals/schema'
import { createHabitSchema } from '../habits/schema'
import { createSyncQueueSchema } from '../sync/schema'
import { logger } from '@services/logger'
import { uuid } from '@services/uuid'
import { nowIso } from './db'

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
  // v13 - habit notification times (JSON array of "HH:MM" strings)
  async (db) => {
    await safeAddColumn(db, 'habit', 'notification_times', 'TEXT')
  },
  // v14 - retired finance funds. Kept as a no-op so historical user_version
  // numbers stay stable; current schema treats fund categories as expenses.
  async (db) => {
    await initFinanceSchema(db)
  },
  // v15 - journal activity tags (comma-separated preset keys)
  async (db) => {
    await safeAddColumn(db, 'journal', 'tags', 'TEXT')
  },
  // v16 - funds become ordinary spending categories
  async (db) => {
    await db.execAsync(`
      UPDATE finance_category
      SET kind = 'discretionary',
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE user_id IS NULL
        AND name IN ('Emergency Fund', 'Investments', 'Learning Fund');
    `)

    const row = await db.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM finance_category WHERE user_id IS NULL AND name = 'Learning Fund'"
    )
    if ((row?.n ?? 0) === 0) {
      const ts = nowIso()
      await db.runAsync(
        `INSERT INTO finance_category (id, user_id, name, icon, color, kind, sort_order, created_at, updated_at)
         VALUES (?, NULL, 'Learning Fund', 'book-open', '#7D5A86', 'discretionary', 14, ?, ?)`,
        [uuid(), ts, ts]
      )
    }
  },
  // v17 - monthly finance plan items for safe-to-spend forecasting
  async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS finance_plan_item (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT,
        name TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('income','expense')),
        amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
        currency TEXT NOT NULL DEFAULT 'VND',
        category_id TEXT,
        due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
        status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','expected')),
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        synced_at TEXT,
        FOREIGN KEY (category_id) REFERENCES finance_category(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_plan_item_user_due
        ON finance_plan_item(user_id, due_day)
        WHERE deleted_at IS NULL AND active = 1;
    `)
  },
  // v18 - explicit transaction ↔ plan-item link (safe-to-spend confirm prompt)
  async (db) => {
    await safeAddColumn(db, 'finance_transaction', 'plan_item_id', 'TEXT')
    await safeAddColumn(db, 'finance_transaction', 'plan_match_dismissed', 'INTEGER NOT NULL DEFAULT 0')
  },
  // v19 - debt book (sổ nợ): finance_debt table + Lending/Borrowing system
  // categories. initFinanceSchema is idempotent and seeds missing categories.
  async (db) => {
    await initFinanceSchema(db)
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
