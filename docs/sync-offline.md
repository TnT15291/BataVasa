# Sync & Offline

> Offline-first architecture. SQLite = source of truth. Supabase = cloud mirror.

## Principles

- **Local-first writes** — every mutation hits SQLite immediately
- **Optimistic UI** — UI reflects local state, sync happens in background
- **Eventually consistent** — cloud catches up when network available

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
