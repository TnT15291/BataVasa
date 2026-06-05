# Database

> SQLite local source of truth, with Supabase as a cloud mirror through the sync
> queue. Current local schema version: v12.

## Conventions

- Tables and columns use `snake_case`.
- IDs are UUID strings stored as `TEXT` locally.
- User-owned rows carry `user_id`.
- Normal delete is soft delete via `deleted_at`.
- Module wipe is hard local delete plus a `sync_queue` wipe operation.
- Domain writes go through `features/<domain>/services.ts`, then
  `database/<domain>/queries.ts`.

Entry rows that represent user activity should carry:

- `occurred_at`: user-meaningful event time, editable and used by reports;
- `created_at`: system insertion time, immutable in normal flows;
- `updated_at`;
- `deleted_at`;
- `synced_at`.

## Location Columns

Activity rows may include optional location fields:

```sql
location_lat   REAL
location_lng   REAL
location_label TEXT
```

If the user clears the label in the form, save all three as `NULL`.

## Core Tables

### `finance_transaction`

Primary finance record.

Important columns:

- `amount_cents INTEGER NOT NULL`: signed; negative expense, positive income.
- `currency TEXT NOT NULL`: transaction native currency.
- `category_id TEXT NOT NULL`.
- `merchant TEXT`.
- `note TEXT`.
- `occurred_at TEXT NOT NULL`.
- `mood TEXT`.
- `source TEXT`: `manual`, `ocr`, `voice`, or `import`.
- `needs_review INTEGER NOT NULL DEFAULT 0`.
- `review_reason TEXT`.
- location columns.
- timestamps and sync columns.

### `finance_category`

System and user categories.

Important columns:

- `user_id TEXT`: `NULL` means system seed row.
- `name TEXT NOT NULL`: canonical English name for seed rows.
- `icon TEXT`.
- `color TEXT`.
- `kind TEXT`: `essential`, `discretionary`, `income`, `savings`.
- `monthly_budget_cents INTEGER`.
- `parent_id TEXT`.
- `sort_order INTEGER`.
- timestamps and sync columns.

System category names are translated at display time through
`features/finance/i18n.ts`.

### `finance_rule`

Merchant/category learning rules.

Important columns:

- `merchant_pattern TEXT NOT NULL`.
- `category_id TEXT NOT NULL`.
- timestamps and sync columns.

### `reminder`

Reminder and inbox item table.

Important columns:

- `title TEXT NOT NULL`.
- `note TEXT`.
- `remind_at TEXT NOT NULL`: scheduled time; inbox items still store a timestamp.
- `advance_minutes INTEGER NOT NULL DEFAULT 0`.
- `recurrence TEXT`: `none`, `daily`, `weekly`, `monthly`.
- `priority TEXT NOT NULL DEFAULT 'medium'`.
- `is_inbox INTEGER NOT NULL DEFAULT 0`.
- `completed INTEGER NOT NULL DEFAULT 0`.
- location columns.
- timestamps and sync columns.

Notification IDs are not stored in SQLite. Runtime notification cleanup is handled
by `services/notifications.ts` and the reminders service.

### `habit`

Habit definition table.

Important columns:

- `name TEXT NOT NULL`.
- `icon TEXT`.
- `color TEXT`.
- `cadence TEXT`: `daily`, `weekdays`, `weekly`, `monthly`, `custom`.
- `target_per_period INTEGER NOT NULL`.
- `schedule_days TEXT`: comma-separated weekday numbers for custom schedules.
- location columns.
- timestamps and sync columns.

Soft-deleted habit rows may still be read by export/report paths so historical
`habit_log` rows can display meaningful names. Normal list screens still use
`deleted_at IS NULL`.

### `habit_log`

Habit completion or skip history.

Important columns:

- `habit_id TEXT NOT NULL`.
- `user_id TEXT`.
- `occurred_at TEXT NOT NULL`.
- `note TEXT`.
- `skipped INTEGER NOT NULL DEFAULT 0`.
- timestamps and sync columns.

Report UI must join or map logs back to habit definitions. Never display
`habit_log.id` or `habit_id` as a user-facing history label; use the habit name
or the translated `deleted_habit` fallback.

### `journal`

Journal entry table. The implemented table name is `journal`, not
`journal_entry`.

Important columns:

- `content TEXT NOT NULL`.
- `mood INTEGER`: 1 to 5.
- `is_important INTEGER NOT NULL DEFAULT 0`.
- `occurred_at TEXT NOT NULL`.
- location columns.
- timestamps and sync columns.

### `settings`

Key/value settings table used by `store/settingsStore.ts`.

Important settings include language, storage currency, display currency, theme,
AI provider, location access, AI confirmation, per-module sync toggles,
onboarding, biometric lock, and microphone privacy prompt state.

### `sync_queue`

Local queue for Supabase mirroring.

Columns:

- `id TEXT PRIMARY KEY`.
- `table_name TEXT NOT NULL`.
- `row_id TEXT NOT NULL`.
- `operation TEXT NOT NULL`: `upsert` or `wipe`.
- `created_at TEXT NOT NULL`.
- `retry_count INTEGER NOT NULL DEFAULT 0`.
- `last_error TEXT`.

`upsert` operations are deduplicated by `(table_name, row_id)`. `wipe` uses
`row_id = 'ALL'`.

## Migrations

Migration runner: `database/core/migrate.ts`.

Rules:

- Append only; never reorder or remove existing migrations.
- Use idempotent schema changes (`CREATE TABLE IF NOT EXISTS`, safe add column).
- `PRAGMA user_version` stores the applied version.

Current versions:

| Version | Content |
|---|---|
| v1 | Finance and settings schemas |
| v2 | Finance transaction location columns |
| v3 | Finance category monthly budget |
| v4 | Reminder schema |
| v5 | Journal schema |
| v6 | Habit schema |
| v7 | Reminder advance minutes |
| v8 | Sync queue |
| v9 | Journal important, reminder priority, habit skip, finance review fields |
| v10 | Finance merchant/category rules |
| v11 | Reminder inbox flag |
| v12 | Habit custom schedule days |

## Query Patterns

- Feature UI should not import database query modules directly.
- Services call query modules.
- Unbounded list queries should paginate at the query layer.
- Counts and summaries should use aggregate queries, not `.length` on a paginated
  page.
- Export/report queries may intentionally include soft-deleted parent records
  when needed to preserve readable history, such as habit skip logs.

Current gap: finance transaction listing is paginated, but reminders, habits,
habit logs, and journals still have some full-list query paths. Treat pagination
for those paths as a product-hardening task before large public use.

## Planned Tables (not yet created)

### `ai_insight` (planned)

Intended to cache generated AI insights per user/module/period to avoid redundant
API calls.

Planned columns: `id`, `user_id`, `module` (`finance`/`habit`/`journal`/`cross`),
`kind` (`weekly`/`monthly`/`pattern`), `period_start`, `period_end`, `content`
(JSON), `model`, `tokens_used`, timestamps.

**Status:** Not yet created — no migration exists. Current AI calls regenerate on
every request. Implement when adding AI budget/caching as a feature.

## Supabase Mirror

Supabase schema and RLS live in `docs/supabase-setup.sql`.

The implemented client sync worker mirrors rows directly with Supabase table
`upsert` and `delete` for wipe operations. There is no custom sync REST endpoint
in the current app.
