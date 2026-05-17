# Sync & Offline

> Offline-first architecture. SQLite = source of truth. Supabase = cloud mirror.

## Principles

- **Local-first writes** — every mutation hits SQLite immediately
- **Optimistic UI** — UI reflects local state, sync happens in background
- **Eventually consistent** — cloud catches up when network available

## AI-parsed entries — Undo window (Cross-Module Rule 5)

When user sets `settingsStore.aiAutoConfirm = false`, AI-parsed entries skip the confirm sheet and save directly. To preserve the safeguard, the sync engine MUST honor a 5-second Undo window:

1. Service writes row to SQLite + marks it with `pending_undo = true` (or holds in memory + delays `sync_queue` insert)
2. Toast shown: `"✓ Saved · Undo"` for 5 seconds
3. On Undo tap → hard-delete the row, never enters `sync_queue`
4. After 5s → drop `pending_undo` flag → row enters `sync_queue` as normal

Voice inputs are exempt — they always show the full confirm sheet regardless of this setting.

## Per-module sync toggle (Cross-Module Rule 1)

Each domain module exposes a sync on/off toggle in Settings.

- Stored: `settingsStore.moduleSync[<module>]: boolean` (default `true`)
- When OFF: writes still go to SQLite + `sync_queue`, but the worker filters out `<module>_*` table ops
- Toggling back ON: worker drains accumulated queue entries on next tick
- Hard requirement: every module that touches user data must register in the toggle list

## Wipe operation

Every module exports `wipeAllData()` from its service layer:

```ts
async function wipeAllData(): Promise<Result<{ deleted: number }, AppError>>
```

Steps:
1. Hard `DELETE FROM <module>_*` in SQLite (no soft tombstone — user wants real removal)
2. Insert special `op: 'wipe'` row into `sync_queue` with table prefix
3. Clear in-memory Zustand store state for that module
4. Sync worker, on next drain, calls `DELETE` on Supabase for matching `user_id` + table prefix
5. Return `{ deleted: <count> }` for confirmation toast

UI lives in `features/settings/screens/<Module>DataScreen.tsx` with destructive-button + double-confirm pattern.

## Sync Engine

Location: `database/sync/`

Flow:
1. Local write → SQLite + `sync_queue` table (entry per pending op)
2. Background worker drains queue → POST to Supabase
3. On success: remove from queue, set `synced_at` on row
4. On failure: exponential backoff, max retries, then surface to user

## Conflict Resolution

**Per-table policies:**

| Table | Policy | Why |
|---|---|---|
| `finance_transaction` | LWW by `updated_at`, but **never resurrect** deleted rows | financial integrity — deletion is intentional |
| `finance_category` (user-owned) | LWW | low-frequency edits |
| `journal_entry` | **Manual review** — surface both versions | body is irreplaceable user content |
| `habit`, `habit_log` | LWW | low value if lost |
| `reminder` | LWW; if local trigger already fired, mark `completed` not `pending` | avoid re-firing notifications |
| `ai_insight` | Server wins | server is generator |

**Mechanics:**
1. Server is authority for conflict detection (compares incoming `updated_at` vs current row)
2. On conflict: server returns `409 CONFLICT` with `{ server_version, client_version }`
3. Client applies table's policy:
   - LWW → take newer `updated_at`, re-queue if local newer
   - Manual → write to `conflict_log` table, prompt user on next app open
4. Soft-deletes are **tombstones**: `deleted_at != NULL` always wins over later un-deletes (no resurrection)

## Network Detection

- Listen to NetInfo (React Native)
- Pause sync worker when offline
- Resume + drain on reconnect

## Edge Cases

- App killed mid-sync → queue persists in SQLite, resumes on next launch
- Same row edited offline on 2 devices → LWW resolves; surface "conflict log" for user review
- Supabase schema drift → fail loudly in dev, log + skip in prod
