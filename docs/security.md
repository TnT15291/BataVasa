# Security

## Authentication (mandatory before any cloud feature)

Auth is a **hard prerequisite** for sync, RLS, multi-device, and any production deployment. Until it ships, all `user_id` columns are `null` and every cloud-tier feature is a stub.

- **Provider:** Supabase Auth (email/password + Apple/Google OAuth)
- **JWT storage:** Expo SecureStore on native, `localStorage` on web (via `services/secureStorage.ts` wrapper). Never AsyncStorage.
- **Token refresh:** handled by Supabase client (auto + refresh on app foreground)
- **Anonymous mode:** allowed for first-launch onboarding; all writes use a local-only `device_id`. On first login, migrate `device_id` rows to the authenticated `user_id` in a single transaction.
- **Sign-out:** wipes JWT + clears Zustand state but does NOT touch SQLite (data remains for next sign-in on same device; user must explicitly use "Delete all data" to remove)
- **Account deletion:** dedicated Settings → Account → "Delete account" → calls Supabase edge function that deletes the auth user + all owned rows (cascade via foreign keys + sync_queue purge)

Cross-cutting requirements (every cloud-touching feature):
- Every service write attaches `user_id = supabase.auth.user().id` (NOT the local `device_id` once authenticated)
- All RLS policies in `docs/security.md#authorization` are required before that table syncs
- Auth state changes (`onAuthStateChange`) must trigger re-load of all module stores

## Encryption

- **At rest:** SQLite encrypted via SQLCipher (key from device keychain)
- **In transit:** HTTPS only, Supabase enforces
- **Sensitive fields** (account numbers, etc.): field-level encryption before DB write

## Finance-specific

- Financial amounts stored as integer (cents) — no floating point
- Never log full transaction details (PII)
- Never send raw merchant/account data to AI without anonymization (see `docs/ai-integration.md`)

## AI write safeguards (Cross-Module Rule 5)

- AI-parsed entries (Smart Entry, voice, Add-Activity) MUST surface `<ConfirmEntrySheet>` before persisting. This is a defense-in-depth safeguard: AI hallucinations or transcription errors should never silently mutate user financial data.
- `settingsStore.aiAutoConfirm` defaults to `true` (sheet shown). User can opt out, but voice inputs ALWAYS confirm regardless of setting.
- When `aiAutoConfirm === false`: save proceeds + show toast with **5s Undo window** before the row is committed to `sync_queue`. Undo within window discards the local row entirely.
- Confirm sheet must echo the raw user input verbatim so the user can spot misinterpretations.

## Location (Cross-Module Rule 6)

- **Opt-in only:** `settingsStore.locationAccess` defaults to `false`. Never fetch GPS unless user explicitly enabled it
- **OS permission** requested lazily — only when user toggles ON in Settings or attempts to use a feature that needs it
- **PII handling:**
  - `location_lat`, `location_lng`, `location_label` are PII — `services/logger.ts` MUST scrub them
  - AI prompts: never include raw coords. Either pass `location_label` only, or round to 0.01° (~1km grid) if coords are needed
  - Sync: location columns mirror to Supabase under same RLS policies (user-scoped)
- **Wipe:** module wipe (Rule 1) clears location columns alongside other deletes
- **Web fallback:** browser geolocation requires HTTPS + user permission prompt — degrade gracefully (return `null`, don't crash) if denied or unsupported

## Authorization

- Row-level security (RLS) on Supabase — user can only access own rows
- No service-role key in client bundle

**RLS policies (template — apply to every user-owned table):**

```sql
-- enable
alter table <table> enable row level security;

-- read own rows
create policy "<table>_select_own" on <table>
  for select using (auth.uid() = user_id);

-- insert with own user_id
create policy "<table>_insert_own" on <table>
  for insert with check (auth.uid() = user_id);

-- update own rows
create policy "<table>_update_own" on <table>
  for update using (auth.uid() = user_id)
              with check (auth.uid() = user_id);

-- soft-delete only via update; no hard delete from client
-- (no delete policy → all DELETE rejected)
```

**Per-table notes:**
- `finance_transaction`, `finance_category` (user rows), `habit`, `habit_log`, `journal_entry`, `reminder`, `ai_insight`, `sync_queue` → full template above
- `finance_category` system rows (user_id IS NULL) → read-only for all authenticated users:
  ```sql
  create policy "finance_category_select_system" on finance_category
    for select using (user_id is null or auth.uid() = user_id);
  ```
- Hard delete restricted to service-role only (account deletion edge function)

## Data Deletion

- **Soft delete** via `deleted_at` — used for normal UI deletes (recoverable until sync purges)
- **Hard delete (wipe)** — per-module "Delete all data" action in Settings + on account removal. Cascades through `sync_queue` to also clear Supabase (Cross-Module Rule 1, see `docs/sync-offline.md`)
- GDPR-compliant export: dump user's rows via service
- Wipe MUST clear in-memory Zustand state too — never leave PII visible after the user asks for it gone

## Secrets

- `.env` files gitignored
- See `docs/ops.md` for env var management
