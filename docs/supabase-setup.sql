-- BataVasa — Supabase table setup
-- Run this entire file in Supabase Dashboard → SQL Editor (once, idempotent).
-- Tables mirror the local SQLite schema. RLS ensures each user only sees their own rows.

-- ─── Finance ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS finance_category (
  id                   TEXT PRIMARY KEY,
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  icon                 TEXT NOT NULL,
  color                TEXT NOT NULL,
  kind                 TEXT NOT NULL,
  parent_id            TEXT,
  sort_order           INTEGER NOT NULL DEFAULT 0,
  monthly_budget_cents INTEGER,
  created_at           TIMESTAMPTZ NOT NULL,
  updated_at           TIMESTAMPTZ NOT NULL,
  deleted_at           TIMESTAMPTZ,
  synced_at            TIMESTAMPTZ
);
ALTER TABLE finance_category ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own their categories" ON finance_category
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS finance_transaction (
  id             TEXT PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents   BIGINT NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'VND',
  category_id    TEXT NOT NULL,
  merchant       TEXT,
  note           TEXT,
  occurred_at    TIMESTAMPTZ NOT NULL,
  mood           TEXT,
  source         TEXT NOT NULL,
  location_lat   REAL,
  location_lng   REAL,
  location_label TEXT,
  created_at     TIMESTAMPTZ NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL,
  deleted_at     TIMESTAMPTZ,
  synced_at      TIMESTAMPTZ
);
ALTER TABLE finance_transaction ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own their transactions" ON finance_transaction
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── Habits ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS habit (
  id                TEXT PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  icon              TEXT NOT NULL DEFAULT '✅',
  color             TEXT NOT NULL DEFAULT '#4CAF50',
  cadence           TEXT NOT NULL DEFAULT 'daily',
  target_per_period INTEGER NOT NULL DEFAULT 1,
  location_lat      REAL,
  location_lng      REAL,
  location_label    TEXT,
  created_at        TIMESTAMPTZ NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL,
  deleted_at        TIMESTAMPTZ,
  synced_at         TIMESTAMPTZ
);
ALTER TABLE habit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own their habits" ON habit
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS habit_log (
  id          TEXT PRIMARY KEY,
  habit_id    TEXT NOT NULL,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL,
  deleted_at  TIMESTAMPTZ,
  synced_at   TIMESTAMPTZ
);
ALTER TABLE habit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own their habit logs" ON habit_log
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── Journals ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS journal (
  id             TEXT PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content        TEXT NOT NULL,
  mood           INTEGER,
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
CREATE POLICY "users own their journals" ON journal
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── Reminders ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reminder (
  id             TEXT PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  note           TEXT,
  remind_at      TIMESTAMPTZ NOT NULL,
  advance_minutes INTEGER NOT NULL DEFAULT 0,
  recurrence     TEXT NOT NULL DEFAULT 'none',
  completed      SMALLINT NOT NULL DEFAULT 0,
  location_lat   REAL,
  location_lng   REAL,
  location_label TEXT,
  created_at     TIMESTAMPTZ NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL,
  deleted_at     TIMESTAMPTZ,
  synced_at      TIMESTAMPTZ
);
ALTER TABLE reminder ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own their reminders" ON reminder
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
