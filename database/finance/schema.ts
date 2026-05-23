import type { SQLiteDatabase } from 'expo-sqlite'
import { uuid } from '@services/uuid'
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

const INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_tx_user_occurred ON finance_transaction(user_id, occurred_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tx_category ON finance_transaction(category_id, occurred_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cat_user_kind ON finance_category(user_id, kind, sort_order) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rule_merchant ON finance_rule(merchant_pattern) WHERE deleted_at IS NULL;
`

type SystemCategory = { name: string; icon: string; color: string; kind: 'essential' | 'discretionary' | 'income' | 'savings' }

const SYSTEM_CATEGORIES: SystemCategory[] = [
  { name: 'Food & Groceries', icon: 'shopping-cart', color: '#E57373', kind: 'essential' },
  { name: 'Transport', icon: 'car', color: '#FFB74D', kind: 'essential' },
  { name: 'Housing', icon: 'home', color: '#A1887F', kind: 'essential' },
  { name: 'Utilities', icon: 'zap', color: '#FFD54F', kind: 'essential' },
  { name: 'Healthcare', icon: 'heart', color: '#F06292', kind: 'essential' },
  { name: 'Dining Out', icon: 'utensils', color: '#FF8A65', kind: 'discretionary' },
  { name: 'Entertainment', icon: 'music', color: '#9575CD', kind: 'discretionary' },
  { name: 'Shopping', icon: 'shopping-bag', color: '#F48FB1', kind: 'discretionary' },
  { name: 'Subscriptions', icon: 'repeat', color: '#7986CB', kind: 'discretionary' },
  { name: 'Salary', icon: 'briefcase', color: '#81C784', kind: 'income' },
  { name: 'Freelance', icon: 'edit', color: '#AED581', kind: 'income' },
  { name: 'Other Income', icon: 'plus-circle', color: '#C5E1A5', kind: 'income' },
  { name: 'Emergency Fund', icon: 'shield', color: '#64B5F6', kind: 'savings' },
  { name: 'Investments', icon: 'trending-up', color: '#4FC3F7', kind: 'savings' },
]

export async function initFinanceSchema(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(CREATE_CATEGORY_SQL)
  await db.execAsync(CREATE_TRANSACTION_SQL)
  await db.execAsync(CREATE_RULE_SQL)
  await db.execAsync(INDEXES_SQL)
  await seedSystemCategories(db)
}

async function seedSystemCategories(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM finance_category WHERE user_id IS NULL'
  )
  if (row && row.n > 0) return

  const ts = nowIso()
  for (let i = 0; i < SYSTEM_CATEGORIES.length; i++) {
    const cat = SYSTEM_CATEGORIES[i]!
    await db.runAsync(
      `INSERT INTO finance_category (id, user_id, name, icon, color, kind, sort_order, created_at, updated_at)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid(), cat.name, cat.icon, cat.color, cat.kind, i, ts, ts]
    )
  }
}
