# Security

> This file separates implemented safeguards from target production safeguards.
> Do not treat the target section as shipped behavior.

## Implemented

### Authentication

- Provider: Supabase Auth.
- Current product behavior: login wall before app use.
- Current auth method: email/password.
- Google OAuth is implemented through Supabase Auth, but still needs manual
  native-device verification.
- Password recovery is handled in-app through deep links.
- Session storage uses the app secure storage wrapper:
  - native: Expo SecureStore;
  - web: localStorage fallback.
- Auth state changes trigger app/store reload behavior.

### Authorization

- Supabase RLS SQL is maintained in `docs/supabase-setup.sql`.
- User-owned tables are expected to scope rows by `user_id`.
- The client must never contain a Supabase service-role key.

### Local Data Handling

- SQLite is local source of truth.
- Normal deletes are soft deletes.
- Module wipe hard-deletes local rows and queues cloud wipe operations.
- Export/wipe flows live under data management settings.

### Logging And Analytics

- Use `services/logger.ts` instead of raw production logging.
- Logger scrubs known PII fields.
- Analytics events must avoid amounts, merchants, journal content, exact
  locations, email, and other PII.

### Biometric Lock

- Biometric lock is implemented with `expo-local-authentication`.
- The Settings privacy toggle controls whether it is active.
- The app locks after the configured AppState/background behavior.

### AI Safeguards

- AI-parsed writes should show confirmation before saving unless the user has
  explicitly disabled confirmation.
- Voice input must always confirm before saving.
- AI prompts should avoid unnecessary PII and exact location coordinates.

Current gap: the documented five-second undo window for `aiAutoConfirm = false`
is not implemented in the sync queue yet.

## Not Implemented / Target Safeguards

These are production-hardening targets, not current shipped behavior:

- SQLCipher-encrypted SQLite database.
- Apple OAuth.
- Google OAuth sign-off on native builds.
- Anonymous local mode with `device_id` to authenticated `user_id` migration.
- Service-role account deletion Edge Function.
- Server-mediated managed AI proxy.
- Explicit cloud-to-local pull/merge conflict review.
- Conflict log UI for journal content conflicts.

## RLS Template

Apply this shape to user-owned Supabase tables:

```sql
alter table <table> enable row level security;

create policy "<table>_select_own" on <table>
  for select using (auth.uid() = user_id);

create policy "<table>_insert_own" on <table>
  for insert with check (auth.uid() = user_id);

create policy "<table>_update_own" on <table>
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

Normal client deletes should be represented as soft deletes via `deleted_at`.
Hard deletes should be limited to module wipe/account deletion flows.

## Sensitive Data Rules

Never log or track:

- transaction amounts;
- merchant names;
- finance notes;
- journal content;
- email;
- raw auth tokens;
- exact coordinates;
- location labels when they can identify the user;
- AI raw prompts containing user content.

AI prompts should use the minimum data needed for the feature. For cross-module
insights, prefer aggregates and anonymized labels.

## Password Recovery

The recovery flow:

1. User requests reset from `AuthScreen`.
2. Supabase sends a recovery link to the configured redirect URL.
3. The app captures the deep link in `usePasswordRecoveryLink`.
4. `UpdatePasswordScreen` updates the password and exits recovery mode.

Required Supabase redirect URLs:

- production: `batavasa://reset-password`
- dev: the Expo Go `exp://.../--/reset-password` URL printed by the dev server

Expired or reused links should surface a localized invalid-link message.

## Data Deletion

Per-module wipe must:

- hard-delete local module rows;
- enqueue `sync_queue` wipe operations for affected Supabase tables;
- clear in-memory store state;
- avoid leaving sensitive records visible after completion.

Future account deletion should be service-role-only on the backend and should
delete the auth user plus all owned rows.
