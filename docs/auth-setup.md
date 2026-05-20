# Auth Setup — Supabase (B1)

> One-time setup to activate authentication. Until you finish this, the app shows a
> "Sign-in unavailable — backend not configured" screen (login wall, by design).
> See `docs/security.md#authentication` for the auth contract.

## What B1 ships

- **Login wall**: app requires sign-in before use (chosen launch behavior).
- **Email/password** auth via Supabase (OAuth deferred to a later pass).
- Every new row is written with the authenticated `user_id` (no more `user_id: null`).
- JWT stored in secure storage (`expo-secure-store` native / `localStorage` web), never AsyncStorage.

> **Note:** B1 only wires *auth*. Pushing data to the cloud (creating the Supabase
> tables + RLS policies, the `sync_queue`, conflict resolution) is **B2 — Sync**.
> You do NOT need to create tables or run the RLS SQL yet for the app to run; you only
> need steps 1–4 below. Step 5 (tables/RLS) is previewed here so it's ready for B2.

---

## Step 1 — Create a free Supabase project

1. Go to <https://supabase.com> → **Sign in** (GitHub login is easiest).
2. **New project** → pick an org → name it e.g. `batavasa` → choose a region near you
   (e.g. *Southeast Asia (Singapore)*) → set a strong **database password** (save it).
3. Wait ~2 min for provisioning.

## Step 2 — Copy your API keys

1. In the project: **Project Settings (gear)** → **API**.
2. Copy two values:
   - **Project URL** → `https://xxxxxxxx.supabase.co`
   - **anon / public** key (the long JWT under "Project API keys"). **NOT** the
     `service_role` key — that must never ship in the app bundle.

## Step 3 — Put the keys in `.env.local`

Create `d:\Claude\BataVasa\.env.local` (this file is gitignored — never commit it):

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...your-anon-key...
```

A template lives at `.env.example`. Then **restart Expo** so it picks up the env:

```
npx expo start -c
```

(`-c` clears the cache so the new `EXPO_PUBLIC_*` vars are bundled.)

## Step 4 — Enable email auth + relax email confirmation for dev

In the Supabase dashboard → **Authentication** → **Providers** → **Email**:

- Ensure **Email** provider is **enabled** (it is by default).
- For local development, **Authentication → Sign In / Providers → Email →
  "Confirm email"**: turn it **OFF** so you can sign up and immediately sign in
  without clicking an email link. (Turn it back ON before public launch.)

That's it — the app's sign-in/sign-up now works.

> **iOS tip:** Supabase sessions can exceed `expo-secure-store`'s 2 KB per-item limit.
> Our storage adapter (`services/supabase.ts`) chunks the session across multiple
> secure-store keys to stay under the limit, so no extra config is needed.

---

## Step 5 — Tables + RLS (PREVIEW — needed for B2 sync, not for B1)

When we build B2, run this in **Supabase → SQL Editor**. Listed now so it's ready.
Policy template is the canonical one from `docs/security.md#authorization`.

```sql
-- Example for one table; repeat per synced table.
create table if not exists finance_transaction (
  id uuid primary key,
  user_id uuid references auth.users on delete cascade,
  amount_cents bigint not null,
  currency text not null default 'VND',
  category_id uuid,
  merchant text,
  note text,
  occurred_at timestamptz not null,
  mood text,
  source text,
  location_lat double precision,
  location_lng double precision,
  location_label text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz
);

alter table finance_transaction enable row level security;
create policy "finance_transaction_select_own" on finance_transaction
  for select using (auth.uid() = user_id);
create policy "finance_transaction_insert_own" on finance_transaction
  for insert with check (auth.uid() = user_id);
create policy "finance_transaction_update_own" on finance_transaction
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- no delete policy → client hard-delete is rejected (soft-delete via deleted_at only)
```

Tables needing the full template (B2): `finance_transaction`, `finance_category`
(plus a system-rows read policy), `habit`, `habit_log`, `journal`, `reminder`,
`ai_insight`, `sync_queue`. See `docs/security.md` for the per-table notes.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| App still shows "backend not configured" | `.env.local` keys missing/typo'd, or Expo not restarted with `-c`. |
| "Invalid login credentials" right after sign-up | "Confirm email" is ON — check inbox, or turn it OFF for dev (Step 4). |
| Web: session not persisting | Some browsers block `localStorage` in private mode — use a normal window. |
| `EXPO_PUBLIC_*` undefined | Vars must be prefixed `EXPO_PUBLIC_` to reach the client bundle; restart with `-c`. |
