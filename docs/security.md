# Security

## Authentication

- Supabase Auth (email/password + OAuth providers)
- JWT stored in Expo SecureStore (never AsyncStorage)
- Token refresh handled by Supabase client

## Encryption

- **At rest:** SQLite encrypted via SQLCipher (key from device keychain)
- **In transit:** HTTPS only, Supabase enforces
- **Sensitive fields** (account numbers, etc.): field-level encryption before DB write

## Finance-specific

- Financial amounts stored as integer (cents) — no floating point
- Never log full transaction details (PII)
- Never send raw merchant/account data to AI without anonymization (see `docs/ai-integration.md`)

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

- Soft delete via `deleted_at`
- Hard delete on user account removal — cascades through sync queue
- GDPR-compliant export: dump user's rows via service

## Secrets

- `.env` files gitignored
- See `docs/ops.md` for env var management
