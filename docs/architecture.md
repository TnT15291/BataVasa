# Architecture

> Current implementation guide. `docs/current-state.md` remains the project status
> source of truth; this file describes how the code is organized.

## System Overview

```text
Expo Router app routes
  -> feature screens/components/hooks
  -> feature application services
  -> SQLite queries + sync queue
  -> Supabase table mirror, when auth and sync are enabled

Cross-cutting services:
  auth, settings, AI, sync, i18n, design, logging, analytics, notifications
```

SQLite is the source of truth for UI reads and writes. Supabase is a cloud mirror
driven by `sync_queue`; UI code should not write to Supabase directly.

## Module Taxonomy

Use "module" carefully. BataVasa has three different kinds of modules.

### Domain Modules

These own user data and must provide CRUD, export, wipe, sync registration, tests,
and i18n coverage.

| Domain | UI | Store | DB | Services |
|---|---|---|---|---|
| Finance | `features/finance/`, `app/finance.tsx` | `store/financeStore.ts` | `database/finance/` | `features/finance/services.ts`, `services/fx.ts` |
| Reminders | `features/reminders/`, `app/reminders.tsx` | `store/remindersStore.ts` | `database/reminders/` | `features/reminders/services.ts`, `services/notifications.ts` |
| Habits | `features/habits/`, `app/habits.tsx` | `store/habitsStore.ts` | `database/habits/` | `features/habits/services.ts` |
| Journals | `features/journals/`, `app/journals.tsx` | `store/journalsStore.ts` | `database/journals/` | `features/journals/services.ts` |

### Cross-Module Surfaces

These read from or dispatch to multiple domain modules. They should not own domain
tables.

| Surface | Files | Role |
|---|---|---|
| Home / Daily Digest | `features/home/` | Summary, onboarding, Universal Add |
| Today Timeline | `features/home/hooks/useDailyDigest.ts` | Presentation read model that merges same-day domain records |
| Analysis | `features/analysis/` | Cross-module reports and patterns |
| Assistant | `features/assistant/` | AI chat/assistant UI with quick prompts |
| Reports routes | `app/*-report.tsx`, module report screens | Domain reports exposed through routes |

### Platform Modules

These are app infrastructure, not product domains.

| Platform area | Files |
|---|---|
| Auth | `features/auth/`, `store/authStore.ts`, `services/supabase.ts`, `services/identity.ts` |
| Settings | `features/settings/`, `store/settingsStore.ts`, `database/settings/` |
| Sync | `database/sync/`, `services/sync.ts` |
| AI | `services/ai/` |
| i18n | `services/i18n/` |
| Design system | `design/`, `docs/design-system.md` |
| Logging/analytics | `services/logger.ts`, `services/analytics.ts` |

## Layering Rules

The current service files under `features/<domain>/services.ts` are application
services, not pure domain services. They are allowed to:

- validate inputs with the domain type schemas;
- call `database/<domain>/queries.ts`;
- attach `user_id` via `services/identity.ts`;
- enqueue sync operations through `database/sync/queue.ts`;
- schedule side effects such as notifications;
- emit analytics events through the allow-listed analytics wrapper.

Feature screens should call stores/hooks/services. They should not import database
queries directly.

Database query modules should remain storage-focused: SQL, row mapping, pagination,
export/wipe helpers, and no UI concerns.

## Domain Contract

Each domain module should expose:

- CRUD service functions for its primary records;
- `exportAll...()` for data management;
- `wipeAll...()` for hard local wipe plus `sync_queue` wipe operation;
- query-layer pagination for unbounded lists;
- sync table mapping in `services/sync.ts`;
- i18n keys in all six translation files for user-facing text;
- focused tests for services, queries, migrations, sync behavior, and AI builders
  where applicable.

## Data Flow

### Timeline / Life Stream

BataVasa does not use a unified `life_events` table as the source of truth. The
timeline/life-stream concept is implemented as a read model:

1. Domain tables keep their own invariants and constraints.
2. `features/home/hooks/useDailyDigest.ts` reads Finance, Reminders, Habits, and
   Journals.
3. It maps those records into `DailyTimelineItem` values.
4. The Home screen sorts and renders them as today's timeline.

This preserves typed domain storage while still giving the UI and AI surfaces a
unified life-stream presentation.

### Manual Entry

1. User edits a form screen.
2. Screen/store calls a domain application service.
3. Service validates and writes to SQLite.
4. Service enqueues `sync_queue` with `operation = 'upsert'`.
5. Store reloads or updates cached state.
6. Sync worker drains to Supabase when signed in and module sync is enabled.

### Delete

Normal deletes are soft deletes: set `deleted_at`, enqueue `upsert`, and let the
cloud mirror receive the tombstone row.

Module wipe is a hard local delete: delete matching local rows, enqueue
`operation = 'wipe'` for each affected table, then clear in-memory state.

### Universal Add

Universal Add lives in `features/home/components/UniversalAddSheet.tsx`.

1. Text is parsed by `services/ai/universalEntry.ts`.
2. The parser returns one or more candidates across Finance, Reminder, Habit, and
   Journal.
3. The sheet shows selectable candidate cards.
4. Selected candidates dispatch to the relevant domain store actions.

Ambiguous or multi-intent text must not be forced silently into a single module.
Voice input must always confirm before saving.

## Sync Model

The implemented sync model is direct Supabase table mirroring, not a custom REST
API.

- Queue table: `sync_queue`
- Operations: `upsert`, `wipe`
- Worker: `services/sync.ts`
- Table-to-module toggle map: `TABLE_MODULE` in `services/sync.ts`
- Supabase schema/RLS: `docs/supabase-setup.sql`

There is currently no implemented `/sync/push` or `/sync/pull` endpoint.

## Cross-Cutting Rules

- SQLite remains the local source of truth.
- Supabase writes happen through the sync queue.
- Stores hold cached/derived state, not durable domain data.
- Settings and auth are platform modules.
- Domain modules own their DB schema and application services.
- Cross-module surfaces may coordinate modules, but should not create new domain
  storage unless a new domain is explicitly introduced.
- AI/report text should be rendered through `components/InsightText.tsx` when the
  response is markdown-like section text. Do not show raw markdown directly in
  product UI.
- Main-screen floating actions should be safe-area aware. Keep one primary
  create FAB floating; move secondary actions such as report/analysis into the
  content or header.
- Finance UI must surface sign/category mismatches as review states. A negative
  transaction attached to an income category should not be presented as a normal
  income-category row.
- Any future domain must be added to: route map, feature folder, store, database,
  sync table map, data management UI, i18n, tests, and Universal Add if applicable.
