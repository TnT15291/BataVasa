# Database

> SQLite (local, source of truth) + Supabase (cloud mirror via sync engine).

## Schema Conventions

- Tables in `snake_case`, columns in `snake_case`
- Every table has: `id` (uuid), `created_at`, `updated_at`, `deleted_at` (soft delete), `synced_at`
- Foreign keys explicit, no implicit cascades

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

### journal_entry

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | |
| body | text | encrypted at field level |
| mood | text | `great` · `good` · `neutral` · `low` · `bad` |
| tags | text[] | |
| occurred_at | timestamptz | entry date |
| ...timestamps | | |

### reminder

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | |
| title | text | |
| body | text | nullable |
| trigger_at | timestamptz | next fire time |
| recurrence | text | RRULE string, nullable |
| notification_id | text | Expo notification handle |
| ...timestamps | | |

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

- Migrations live in `database/migrations/`
- Filename: `<timestamp>_<description>.sql`
- Never edit a shipped migration — write a new one

## Query Patterns

- All queries typed via generated types from schema
- No raw SQL in feature code — go through `database/<module>/queries.ts`
- Reads can be cached in-memory; writes always hit SQLite immediately

## Sync to Supabase

See `docs/sync-offline.md` for sync engine details.
