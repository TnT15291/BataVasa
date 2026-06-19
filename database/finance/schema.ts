import type { SQLiteDatabase } from 'expo-sqlite'
import { nowIso } from '@db/core/db'

const CREATE_CATEGORY_SQL = `
CREATE TABLE IF NOT EXISTS finance_category (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('essential','discretionary','income','savings')),
  parent_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  synced_at TEXT,
  FOREIGN KEY (parent_id) REFERENCES finance_category(id) ON DELETE SET NULL
);
`

const CREATE_TRANSACTION_SQL = `
CREATE TABLE IF NOT EXISTS finance_transaction (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents <> 0),
  currency TEXT NOT NULL DEFAULT 'VND',
  category_id TEXT NOT NULL,
  merchant TEXT,
  note TEXT,
  occurred_at TEXT NOT NULL,
  mood TEXT CHECK (mood IN ('great','good','neutral','low','bad') OR mood IS NULL),
  source TEXT NOT NULL CHECK (source IN ('manual','ocr','voice','import')),
  needs_review INTEGER NOT NULL DEFAULT 0 CHECK (needs_review IN (0,1)),
  review_reason TEXT,
  plan_item_id TEXT,
  plan_match_dismissed INTEGER NOT NULL DEFAULT 0 CHECK (plan_match_dismissed IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  synced_at TEXT,
  FOREIGN KEY (category_id) REFERENCES finance_category(id) ON DELETE RESTRICT
);
`

const CREATE_RULE_SQL = `
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
`

const CREATE_PLAN_ITEM_SQL = `
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
`

const CREATE_DEBT_SQL = `
CREATE TABLE IF NOT EXISTS finance_debt (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('lent','borrowed')),
  counterparty TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'VND',
  note TEXT,
  occurred_at TEXT NOT NULL,
  due_at TEXT,
  remind_days_before INTEGER NOT NULL DEFAULT 1,
  reminder_id TEXT,
  transaction_id TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','settled')),
  settled_at TEXT,
  settled_transaction_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  synced_at TEXT
);
`

const INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_tx_user_occurred ON finance_transaction(user_id, occurred_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tx_category ON finance_transaction(category_id, occurred_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cat_user_kind ON finance_category(user_id, kind, sort_order) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rule_merchant ON finance_rule(merchant_pattern) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_plan_item_user_due ON finance_plan_item(user_id, due_day) WHERE deleted_at IS NULL AND active = 1;
CREATE INDEX IF NOT EXISTS idx_debt_user_status ON finance_debt(user_id, status, due_at) WHERE deleted_at IS NULL;
`

type SystemCategory = { id: string; name: string; icon: string; color: string; kind: 'essential' | 'discretionary' | 'income' | 'savings' }

// System categories use STABLE, deterministic ids (same on every device) so they
// never duplicate across devices/reinstalls and transactions referencing them
// resolve everywhere. They are seeded locally on each device and MUST NOT be
// synced (see services/sync.ts). Previously these used random uuid() ids, which
// — combined with the sync push — multiplied them on every device. Migration v20
// collapses the old random-id duplicates onto these canonical ids.
export const SYSTEM_CATEGORIES: SystemCategory[] = [
  { id: 'sys_food_groceries', name: 'Food & Groceries', icon: 'shopping-cart', color: '#E57373', kind: 'essential' },
  { id: 'sys_transport',      name: 'Transport',        icon: 'car', color: '#FFB74D', kind: 'essential' },
  { id: 'sys_housing',        name: 'Housing',          icon: 'home', color: '#A1887F', kind: 'essential' },
  { id: 'sys_utilities',      name: 'Utilities',        icon: 'zap', color: '#FFD54F', kind: 'essential' },
  { id: 'sys_healthcare',     name: 'Healthcare',       icon: 'heart', color: '#F06292', kind: 'essential' },
  { id: 'sys_dining_out',     name: 'Dining Out',       icon: 'utensils', color: '#FF8A65', kind: 'discretionary' },
  { id: 'sys_entertainment',  name: 'Entertainment',    icon: 'music', color: '#9575CD', kind: 'discretionary' },
  { id: 'sys_shopping',       name: 'Shopping',         icon: 'shopping-bag', color: '#F48FB1', kind: 'discretionary' },
  { id: 'sys_subscriptions',  name: 'Subscriptions',    icon: 'repeat', color: '#7986CB', kind: 'discretionary' },
  { id: 'sys_salary',         name: 'Salary',           icon: 'briefcase', color: '#81C784', kind: 'income' },
  { id: 'sys_freelance',      name: 'Freelance',        icon: 'edit', color: '#AED581', kind: 'income' },
  { id: 'sys_other_income',   name: 'Other Income',     icon: 'plus-circle', color: '#C5E1A5', kind: 'income' },
  { id: 'sys_emergency_fund', name: 'Emergency Fund',   icon: 'shield', color: '#64B5F6', kind: 'discretionary' },
  { id: 'sys_learning_fund',  name: 'Learning Fund',    icon: 'book-open', color: '#7D5A86', kind: 'discretionary' },
  { id: 'sys_investments',    name: 'Investments',      icon: 'trending-up', color: '#4FC3F7', kind: 'discretionary' },
  // Debt book (sổ nợ): money going out (lend out / repay what I borrowed) vs
  // money coming in (borrow / collect what I lent). Translated at display time.
  { id: 'sys_lending',        name: 'Lending',          icon: 'user-minus', color: '#8D6E63', kind: 'essential' },
  { id: 'sys_borrowing',      name: 'Borrowing',        icon: 'user-plus', color: '#90A4AE', kind: 'income' },
]

// Exact English seed names — used to detect system rows leaking through sync so
// the pull can skip them (services/sync.ts) and the migration can dedup them.
export const SYSTEM_CATEGORY_NAMES: ReadonlySet<string> = new Set(SYSTEM_CATEGORIES.map((c) => c.name))

export async function initFinanceSchema(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(CREATE_CATEGORY_SQL)
  await db.execAsync(CREATE_TRANSACTION_SQL)
  await db.execAsync(CREATE_RULE_SQL)
  await db.execAsync(CREATE_PLAN_ITEM_SQL)
  await db.execAsync(CREATE_DEBT_SQL)
  await db.execAsync(INDEXES_SQL)
  await seedSystemCategories(db)
}

// Insert any system category that is missing by its stable id, so existing
// installs pick up categories added in later app versions (e.g. Lending/
// Borrowing) and fresh installs get the canonical ids. Idempotent by id.
async function seedSystemCategories(db: SQLiteDatabase): Promise<void> {
  const rows = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM finance_category WHERE id LIKE ?',
    ['sys_%']
  )
  const existing = new Set(rows.map((r) => r.id))

  const ts = nowIso()
  for (let i = 0; i < SYSTEM_CATEGORIES.length; i++) {
    const cat = SYSTEM_CATEGORIES[i]!
    if (existing.has(cat.id)) continue
    await db.runAsync(
      `INSERT INTO finance_category (id, user_id, name, icon, color, kind, sort_order, created_at, updated_at)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
      [cat.id, cat.name, cat.icon, cat.color, cat.kind, i, ts, ts]
    )
  }
}

/**
 * Collapse legacy duplicate system categories onto their canonical stable ids.
 *
 * Root cause: system categories used random per-device ids and were pushed to
 * the cloud as user-owned rows, so every device/reinstall multiplied them. This
 * remaps every transaction / rule / plan-item / debt-link that points at a
 * duplicate (any row whose name matches a system seed but whose id is not the
 * canonical `sys_*` id) onto the canonical row, then deletes the duplicates.
 *
 * Matches by exact English seed name. A user who created a custom category with
 * the exact English name (e.g. "Transport") would be merged too — accepted as a
 * rare edge case for this cleanup.
 */
export async function dedupSystemCategories(db: SQLiteDatabase): Promise<void> {
  // Ensure the canonical rows exist first.
  await seedSystemCategories(db)

  for (const cat of SYSTEM_CATEGORIES) {
    const dups = await db.getAllAsync<{ id: string }>(
      'SELECT id FROM finance_category WHERE name = ? AND id <> ?',
      [cat.name, cat.id]
    )
    for (const dup of dups) {
      await db.runAsync('UPDATE finance_transaction SET category_id = ? WHERE category_id = ?', [cat.id, dup.id])
      await db.runAsync('UPDATE finance_rule SET category_id = ? WHERE category_id = ?', [cat.id, dup.id])
      await db.runAsync('UPDATE finance_plan_item SET category_id = ? WHERE category_id = ?', [cat.id, dup.id])
      await db.runAsync('DELETE FROM finance_category WHERE id = ?', [dup.id])
    }
    // Canonical row must be a proper, non-deleted system row.
    await db.runAsync(
      `UPDATE finance_category
       SET user_id = NULL, name = ?, icon = ?, color = ?, kind = ?, deleted_at = NULL
       WHERE id = ?`,
      [cat.name, cat.icon, cat.color, cat.kind, cat.id]
    )
  }
}
