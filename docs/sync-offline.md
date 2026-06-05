# Sync & Offline

> Offline-first architecture. SQLite is the local source of truth. Supabase is a
> cloud mirror driven by `sync_queue`.

## Current Status

Implemented:

- Local `sync_queue` table.
- Queue enqueue from Finance, Reminders, Habits, and Journals service writes.
- AppState-based sync worker in `services/sync.ts`.
- Per-module sync toggles in `store/settingsStore.ts`.
- Supabase table/RLS setup SQL in `docs/supabase-setup.sql`.
- Queue retry count and last error tracking.

Not implemented yet:

- Server-mediated `/sync/push` or `/sync/pull`.
- Cloud-to-local pull/merge.
- Conflict review UI.
- `conflict_log` table.
- Network reachability listener beyond app foreground drain.
- Five-second undo delay before sync queue insertion for `aiAutoConfirm = false`.

## Principles

- Local writes must succeed without network.
- UI reads from SQLite-backed stores, not Supabase.
- Supabase writes happen in the background through the queue.
- If module sync is disabled, local writes still happen and queue rows remain
  pending.

## Queue Schema

`database/sync/schema.ts` defines:

```sql
sync_queue (
  id TEXT PRIMARY KEY NOT NULL,
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('upsert', 'wipe')),
  created_at TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
)
```

`upsert` rows are deduplicated by `(table_name, row_id)`.

## Operations

### `upsert`

Used for create, update, and soft delete.

Flow:

1. Domain service writes the row to SQLite.
2. Domain service enqueues `operation = 'upsert'`.
3. Worker fetches the current local row.
4. Worker sends the row to Supabase with `upsert(..., { onConflict: 'id' })`.
5. On success, worker updates the row `synced_at` and removes the queue item.

Soft-deleted rows are mirrored as rows with `deleted_at` set.

### `wipe`

Used by module-level destructive wipe actions.

Flow:

1. Domain service hard-deletes local rows for the module.
2. Domain service enqueues `operation = 'wipe'` for each affected table.
3. Worker deletes Supabase rows where `user_id` is the signed-in user.
4. Worker removes the queue item.

## Table Mapping

The sync worker maps tables to settings toggles in `services/sync.ts`.

| Table | Toggle |
|---|---|
| `finance_transaction` | `syncFinance` |
| `finance_category` | `syncFinance` |
| `finance_rule` | `syncFinance` |
| `reminder` | `syncReminders` |
| `habit` | `syncHabits` |
| `habit_log` | `syncHabits` |
| `journal` | `syncJournals` |

Any future domain table must be added to this map and to the data-management UI.

## Retry Behavior

- Worker processes up to 50 pending items per drain.
- Failed items increment `retry_count` and store `last_error`.
- Items with retry count at or above the max retry threshold are purged by the
  current implementation.

Current hardening gap: purging max-retry items can hide persistent sync failure
from users. Before public launch, prefer a visible "sync needs attention" state
instead of silent purge.

## Conflict Model

Current implementation is push-only and direct-table upsert. It does not yet
perform explicit conflict detection.

Target conflict policy for a future pull/merge system:

| Table | Target policy |
|---|---|
| `finance_transaction` | Last-write-wins, with deleted rows never resurrected |
| `finance_category` | Last-write-wins |
| `journal` | Last-write-wins (manual review UI is not implemented — do not mark complete until a pull/merge path and conflict review UI exist) |
| `habit`, `habit_log` | Last-write-wins |
| `reminder` | Last-write-wins, avoid refiring stale notifications |

Do not mark conflict handling complete until there is a pull/merge path and tests.

## AI Save Undo Window

Security/product docs describe a desired five-second undo window when
`settingsStore.aiAutoConfirm === false`. The current sync queue enqueues
immediately from domain services.

If this safeguard is implemented later, the service should either:

- delay queue insertion until the undo window expires; or
- write a local pending state and have the queue worker skip pending rows.

Voice input still must always show confirmation before saving.
