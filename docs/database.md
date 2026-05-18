# Database

> SQLite (local, source of truth) + Supabase (cloud mirror via sync engine).

## Schema Conventions

- Tables in `snake_case`, columns in `snake_case`
- Every table has: `id` (uuid), `created_at`, `updated_at`, `deleted_at` (soft delete), `synced_at`
- **`occurred_at` vs `created_at`** (Cross-Module Rule 4): every entry table that represents a user-meaningful event MUST have both. `occurred_at` = when the event happened (user-editable, supports backdating); `created_at` = system insert time (immutable). Lists, reports, and AI insights group by `occurred_at`, audit logs by `created_at`.
- Foreign keys explicit, no implicit cascades
- **Soft delete** = regular delete via UI (sets `deleted_at`). **Hard delete** = only via `wipeAllData()` from Settings → "Delete all data" (see `docs/sync-offline.md`).

### Location columns (Cross-Module Rule 6)

Every entry table that represents a user activity (transactions, habit logs, journal entries, reminders, …) MUST include three nullable location columns:

```sql
location_lat   REAL    -- WGS84, nullable
location_lng   REAL    -- WGS84, nullable
location_label TEXT    -- reverse-geocoded or user-typed, nullable
```

All three are independently nullable. At save time, an empty `location_label` from the form means store `NULL` for **all three** columns — respect user intent if they clear it.

### Translatable seed data (Cross-Module Rule 2)

System-seeded rows (default categories, habit templates, mood labels, …) store their canonical **English** `name` in the DB. Translation happens at the UI layer via a per-module lookup helper:

- `features/<module>/i18n.ts` exports `translateX(row, t)` that:
  - Returns `t.<key>` if `row.user_id == null` and `row.name` matches a known seed
  - Returns `row.name` as-is for user-created rows
- AI prompts and matching logic use the English `name` for stability (don't break when user switches language)
- Adding a new seed row: insert canonical English name + add translation key to all 6 language files + register in `<module>/i18n.ts`

Why not store a translation key in the DB? Schema stays language-agnostic, no migration needed when adding languages or renaming labels, and user-created rows naturally fall through.

## Tables

### finance_transaction

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → auth.users (Supabase) |
| amount_cents | integer | required, signed (negative = expense, positive = income) |
| currency | text | ISO 4217, default `VND` |
| category_id | uuid | FK → finance_category.id |
| merchant | text | nullable, free-text |
| note | text | nullable |
| occurred_at | timestamptz | when the transaction happened (not when logged) |
| mood | text | nullable, FK → journal_mood (for emotional spending correlation) |
| source | text | `manual` · `ocr` · `voice` · `import` |
| created_at | timestamptz | required |
| updated_at | timestamptz | required |
| deleted_at | timestamptz | soft delete |
| synced_at | timestamptz | last successful Supabase sync |

Indexes: `(user_id, occurred_at DESC)`, `(user_id, category_id, occurred_at DESC)`

### finance_category

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | nullable — null = system default |
| name | text | required |
| icon | text | icon key |
| color | text | hex |
| kind | text | `essential` · `discretionary` · `income` · `savings` |
| monthly_budget_cents | integer | nullable — null = no limit |
| parent_id | uuid | nullable, FK self-ref for hierarchy |
| sort_order | integer | |
| ...timestamps | | |

### habit

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | |
| name | text | |
| cadence | text | `daily` · `weekdays` · `custom` |
| target_per_period | integer | e.g. 1 per day |
| reminder_time | time | nullable |
| ...timestamps | | |

### habit_log

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| habit_id | uuid | FK |
| logged_at | timestamptz | |
| ...timestamps | | |

### journal

| Column | Type | Notes |
|---|---|---|
| id | TEXT | PK (uuid) |
| user_id | TEXT | nullable |
| content | TEXT | required, free-form text (up to 10 000 chars) |
| mood | INTEGER | nullable, 1–5 (1=very sad → 5=very happy) |
| occurred_at | TEXT | ISO datetime — when the entry is about |
| location_lat | REAL | nullable |
| location_lng | REAL | nullable |
| location_label | TEXT | nullable |
| created_at | TEXT | required |
| updated_at | TEXT | required |
| deleted_at | TEXT | soft delete |
| synced_at | TEXT | last Supabase sync |

Index: `(user_id, occurred_at)` WHERE `deleted_at IS NULL`

### reminder

| Column | Type | Notes |
|---|---|---|
| id | TEXT | PK (uuid) |
| user_id | TEXT | nullable |
| title | TEXT | required |
| note | TEXT | nullable |
| remind_at | TEXT | ISO datetime — when to fire |
| recurrence | TEXT | `none` · `daily` · `weekly` · `monthly` |
| completed | INTEGER | 0 or 1 (SQLite boolean) |
| location_lat | REAL | nullable |
| location_lng | REAL | nullable |
| location_label | TEXT | nullable |
| created_at | TEXT | required |
| updated_at | TEXT | required |
| deleted_at | TEXT | soft delete |
| synced_at | TEXT | last Supabase sync |

Index: `(user_id, remind_at)` WHERE `deleted_at IS NULL`

Note: notification scheduling is handled in-process via `expo-notifications` (`services/notifications.ts`). No `notification_id` column — IDs are cached in-memory via `notifCache: Map<reminderId, notifId>` in `features/reminders/services.ts`.

### ai_insight

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | |
| module | text | `finance` · `habit` · `journal` · `cross` |
| kind | text | `weekly` · `monthly` · `pattern` · `recommendation` |
| period_start | date | |
| period_end | date | |
| content | jsonb | structured insight |
| model | text | OpenAI model used |
| tokens_used | integer | |
| ...timestamps | | |

### sync_queue

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| table_name | text | target table |
| row_id | uuid | target row |
| op | text | `insert` · `update` · `delete` |
| payload | jsonb | row data |
| attempts | integer | |
| last_error | text | nullable |
| next_attempt_at | timestamptz | |
| created_at | timestamptz | |

## Migrations

- Migration runner: `database/core/migrate.ts` — `runMigrations()` called once in `app/_layout.tsx` before settings load
- Each migration is a function in the `MIGRATIONS` array (0-indexed), applied via `PRAGMA user_version`
- All migrations use `CREATE TABLE IF NOT EXISTS` / `safeAddColumn()` — fully idempotent
- Never remove or reorder a migration — only append new ones

**Current schema versions:**
| Version | Content |
|---|---|
| v1 | `finance_transaction`, `finance_category`, `settings` |
| v2 | Location columns (`location_lat/lng/label`) on `finance_transaction` |
| v3 | `monthly_budget_cents` on `finance_category` |
| v4 | `reminder` table |
| v5 | `journal` table |

## Query Patterns

- All queries typed via generated types from schema
- No raw SQL in feature code — go through `database/<module>/queries.ts`
- Reads can be cached in-memory; writes always hit SQLite immediately

### Pagination (mandatory for unbounded lists)

Any table that grows unboundedly (transactions, habit logs, journal entries, …) MUST paginate at the query layer:

- Query exposes `{ limit?: number; offset?: number }` or `{ cursor?: string; limit?: number }`
- Default `limit = 50`, hard cap `200`
- UI uses `FlashList` `onEndReached` to load next page; store accumulates pages in memory
- "Load older" CTA + skeleton at list bottom while fetching
- Counts (for summary cards) use a separate `SELECT COUNT(*)` / `SUM(...)` query — never `.length` on a paginated list

Anti-pattern: `listX()` with no limit + UI shows `data.slice(0, 100)` → silent truncation hides user data.

## Web fallback

`expo-sqlite` on web uses **wa-sqlite + OPFS** for persistence. Browser support:
- ✅ Chrome 110+, Edge, Safari 17+ — full persistence
- ⚠️ Firefox — falls back to in-memory; data lost on reload
- Recommendation: show a non-blocking banner on web Firefox users: "Your browser doesn't support persistent storage. Use Chrome/Safari for best experience, or install the mobile app."

## Sync to Supabase

See `docs/sync-offline.md` for sync engine details.
