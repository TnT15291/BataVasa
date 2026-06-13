-- BataVasa — Supabase setup (v19, 2026-06-12)
-- Run this entire file in Supabase Dashboard → SQL Editor (idempotent).
-- Tables mirror the local SQLite schema; RLS ensures each user sees only their own rows.
--
-- Auth → URL Configuration → Redirect URLs must include:
--   batavasa://auth/callback   (Google OAuth deep link on Android)
--   batavasa://reset-password  (password recovery deep link)

-- ─── Finance ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS finance_category (
  id                   TEXT        PRIMARY KEY,
  user_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                 TEXT        NOT NULL,
  icon                 TEXT        NOT NULL,
  color                TEXT        NOT NULL,
  kind                 TEXT        NOT NULL CHECK (kind IN ('essential','discretionary','income','savings')),
  parent_id            TEXT,
  sort_order           INTEGER     NOT NULL DEFAULT 0,
  monthly_budget_cents INTEGER,
  created_at           TIMESTAMPTZ NOT NULL,
  updated_at           TIMESTAMPTZ NOT NULL,
  deleted_at           TIMESTAMPTZ,
  synced_at            TIMESTAMPTZ
);
ALTER TABLE finance_category ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users own their categories" ON finance_category;
CREATE POLICY "users own their categories" ON finance_category
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_cat_user_kind
  ON finance_category (user_id, kind, sort_order) WHERE deleted_at IS NULL;

-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS finance_transaction (
  id             TEXT        PRIMARY KEY,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents   BIGINT      NOT NULL CHECK (amount_cents <> 0),
  currency       TEXT        NOT NULL DEFAULT 'VND',
  category_id    TEXT        NOT NULL,
  merchant       TEXT,
  note           TEXT,
  occurred_at    TIMESTAMPTZ NOT NULL,
  mood           TEXT        CHECK (mood IN ('great','good','neutral','low','bad')),
  source         TEXT        NOT NULL CHECK (source IN ('manual','ocr','voice','import')),
  needs_review   SMALLINT    NOT NULL DEFAULT 0 CHECK (needs_review IN (0,1)),
  review_reason  TEXT,
  location_lat   REAL,
  location_lng   REAL,
  location_label TEXT,
  plan_item_id   TEXT,
  plan_match_dismissed SMALLINT NOT NULL DEFAULT 0 CHECK (plan_match_dismissed IN (0,1)),
  created_at     TIMESTAMPTZ NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL,
  deleted_at     TIMESTAMPTZ,
  synced_at      TIMESTAMPTZ
);
ALTER TABLE finance_transaction ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users own their transactions" ON finance_transaction;
CREATE POLICY "users own their transactions" ON finance_transaction
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_tx_user_occurred
  ON finance_transaction (user_id, occurred_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tx_category
  ON finance_transaction (category_id, occurred_at DESC) WHERE deleted_at IS NULL;

-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS finance_rule (
  id               TEXT        PRIMARY KEY,
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_pattern TEXT        NOT NULL,
  category_id      TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL,
  updated_at       TIMESTAMPTZ NOT NULL,
  deleted_at       TIMESTAMPTZ,
  synced_at        TIMESTAMPTZ
);
ALTER TABLE finance_rule ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users own their finance rules" ON finance_rule;
CREATE POLICY "users own their finance rules" ON finance_rule
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_rule_merchant
  ON finance_rule (merchant_pattern) WHERE deleted_at IS NULL;

-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS finance_plan_item (
  id           TEXT        PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  kind         TEXT        NOT NULL CHECK (kind IN ('income','expense')),
  amount_cents BIGINT      NOT NULL CHECK (amount_cents > 0),
  currency     TEXT        NOT NULL DEFAULT 'VND',
  category_id  TEXT,
  due_day      INTEGER     NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  status       TEXT        NOT NULL DEFAULT 'confirmed'
                          CHECK (status IN ('confirmed','expected')),
  active       SMALLINT    NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at   TIMESTAMPTZ NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL,
  deleted_at   TIMESTAMPTZ,
  synced_at    TIMESTAMPTZ
);
ALTER TABLE finance_plan_item ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users own their finance plan items" ON finance_plan_item;
CREATE POLICY "users own their finance plan items" ON finance_plan_item
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_plan_item_user_due
  ON finance_plan_item (user_id, due_day) WHERE deleted_at IS NULL AND active = 1;

-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS finance_debt (
  id                     TEXT        PRIMARY KEY,
  user_id                UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  direction              TEXT        NOT NULL CHECK (direction IN ('lent','borrowed')),
  counterparty           TEXT        NOT NULL,
  amount_cents           BIGINT      NOT NULL CHECK (amount_cents > 0),
  currency               TEXT        NOT NULL DEFAULT 'VND',
  note                   TEXT,
  occurred_at            TIMESTAMPTZ NOT NULL,
  due_at                 TIMESTAMPTZ,
  remind_days_before     INTEGER     NOT NULL DEFAULT 1,
  reminder_id            TEXT,
  transaction_id         TEXT,
  status                 TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open','settled')),
  settled_at             TIMESTAMPTZ,
  settled_transaction_id TEXT,
  created_at             TIMESTAMPTZ NOT NULL,
  updated_at             TIMESTAMPTZ NOT NULL,
  deleted_at             TIMESTAMPTZ,
  synced_at              TIMESTAMPTZ
);
ALTER TABLE finance_debt ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users own their debts" ON finance_debt;
CREATE POLICY "users own their debts" ON finance_debt
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_debt_user_status
  ON finance_debt (user_id, status, due_at) WHERE deleted_at IS NULL;

-- ─── Habits ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS habit (
  id                 TEXT        PRIMARY KEY,
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name               TEXT        NOT NULL,
  icon               TEXT        NOT NULL DEFAULT '✅',
  color              TEXT        NOT NULL DEFAULT '#4CAF50',
  cadence            TEXT        NOT NULL DEFAULT 'daily',
  target_per_period  INTEGER     NOT NULL DEFAULT 1,
  schedule_days      TEXT,
  notification_times TEXT,
  location_lat       REAL,
  location_lng       REAL,
  location_label     TEXT,
  created_at         TIMESTAMPTZ NOT NULL,
  updated_at         TIMESTAMPTZ NOT NULL,
  deleted_at         TIMESTAMPTZ,
  synced_at          TIMESTAMPTZ
);
ALTER TABLE habit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users own their habits" ON habit;
CREATE POLICY "users own their habits" ON habit
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_habit_user
  ON habit (user_id) WHERE deleted_at IS NULL;

-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS habit_log (
  id          TEXT        PRIMARY KEY,
  habit_id    TEXT        NOT NULL,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL,
  note        TEXT,
  skipped     SMALLINT    NOT NULL DEFAULT 0 CHECK (skipped IN (0,1)),
  created_at  TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL,
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ
);
ALTER TABLE habit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users own their habit logs" ON habit_log;
CREATE POLICY "users own their habit logs" ON habit_log
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_habit_log_habit_date
  ON habit_log (habit_id, occurred_at) WHERE deleted_at IS NULL;

-- ─── Journals ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS journal (
  id             TEXT        PRIMARY KEY,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content        TEXT        NOT NULL,
  mood           INTEGER,
  is_important   SMALLINT    NOT NULL DEFAULT 0 CHECK (is_important IN (0,1)),
  tags           TEXT,
  occurred_at    TIMESTAMPTZ NOT NULL,
  location_lat   REAL,
  location_lng   REAL,
  location_label TEXT,
  created_at     TIMESTAMPTZ NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL,
  deleted_at     TIMESTAMPTZ,
  synced_at      TIMESTAMPTZ
);
ALTER TABLE journal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users own their journals" ON journal;
CREATE POLICY "users own their journals" ON journal
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_journal_occurred_at
  ON journal (user_id, occurred_at) WHERE deleted_at IS NULL;

-- ─── Reminders ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reminder (
  id              TEXT        PRIMARY KEY,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  note            TEXT,
  remind_at       TIMESTAMPTZ NOT NULL,
  advance_minutes INTEGER     NOT NULL DEFAULT 0,
  recurrence      TEXT        NOT NULL DEFAULT 'none'
                              CHECK (recurrence IN ('none','daily','weekly','monthly')),
  priority        TEXT        NOT NULL DEFAULT 'medium'
                              CHECK (priority IN ('low','medium','high')),
  is_inbox        SMALLINT    NOT NULL DEFAULT 0 CHECK (is_inbox IN (0,1)),
  completed       SMALLINT    NOT NULL DEFAULT 0 CHECK (completed IN (0,1)),
  location_lat    REAL,
  location_lng    REAL,
  location_label  TEXT,
  created_at      TIMESTAMPTZ NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL,
  deleted_at      TIMESTAMPTZ,
  synced_at       TIMESTAMPTZ
);
ALTER TABLE reminder ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users own their reminders" ON reminder;
CREATE POLICY "users own their reminders" ON reminder
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_reminder_remind_at
  ON reminder (user_id, remind_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reminder_completed
  ON reminder (user_id, completed) WHERE deleted_at IS NULL;

-- ─── Backward compat (existing Supabase projects only) ────────────────────────
-- Safe to run on fresh projects too — IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.

ALTER TABLE finance_category    ADD COLUMN IF NOT EXISTS monthly_budget_cents INTEGER;
ALTER TABLE finance_transaction ADD COLUMN IF NOT EXISTS needs_review   SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE finance_transaction ADD COLUMN IF NOT EXISTS review_reason  TEXT;
ALTER TABLE finance_transaction ADD COLUMN IF NOT EXISTS location_lat   REAL;
ALTER TABLE finance_transaction ADD COLUMN IF NOT EXISTS location_lng   REAL;
ALTER TABLE finance_transaction ADD COLUMN IF NOT EXISTS location_label TEXT;
ALTER TABLE finance_transaction ADD COLUMN IF NOT EXISTS plan_item_id   TEXT;
ALTER TABLE finance_transaction ADD COLUMN IF NOT EXISTS plan_match_dismissed SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE habit               ADD COLUMN IF NOT EXISTS schedule_days      TEXT;
ALTER TABLE habit               ADD COLUMN IF NOT EXISTS notification_times TEXT;
ALTER TABLE habit_log           ADD COLUMN IF NOT EXISTS skipped SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE journal             ADD COLUMN IF NOT EXISTS is_important SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE journal             ADD COLUMN IF NOT EXISTS tags TEXT;
ALTER TABLE reminder            ADD COLUMN IF NOT EXISTS advance_minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reminder            ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE reminder            ADD COLUMN IF NOT EXISTS is_inbox SMALLINT NOT NULL DEFAULT 0;

-- Fund categories are now regular spending categories.
UPDATE finance_category
SET kind = 'discretionary', updated_at = NOW()
WHERE kind = 'savings'
  AND name IN ('Emergency Fund', 'Learning Fund', 'Investments');

-- Remove retired fund columns/tables if they exist from older schema versions.
ALTER TABLE finance_transaction DROP COLUMN IF EXISTS fund_id;
DROP TABLE IF EXISTS finance_fund;
