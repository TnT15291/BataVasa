# Auth Setup - Supabase

> One-time setup for a local/dev/prod Supabase project. The app uses a login wall
> and Supabase email/password auth.

## What Auth Currently Uses

- Supabase Auth.
- Email/password sign up and sign in.
- In-app password recovery through deep links.
- Session persistence through `services/supabase.ts` and the secure storage
  wrapper.
- Login wall before using the app.

OAuth, anonymous mode, and account deletion Edge Functions are not implemented
yet; see `docs/security.md`.

## Step 1 - Create A Supabase Project

1. Go to <https://supabase.com>.
2. Create a new project.
3. Choose a region close to the target users.
4. Save the database password somewhere secure.

## Step 2 - Copy Client API Values

In Supabase Dashboard -> Project Settings -> API, copy:

- Project URL.
- `anon` public key.

Never use the `service_role` key in the client app.

## Step 3 - Create `.env.local`

Create `d:\Claude\BataVasa\.env.local`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Restart Expo with cache clear:

```bash
npx expo start -c
```

`EXPO_PUBLIC_*` variables are bundled into the client, so only public client
values belong here.

## Step 4 - Configure Email Auth

In Supabase Dashboard -> Authentication -> Providers -> Email:

- Ensure Email provider is enabled.
- For local development, you may turn email confirmation off so test accounts can
  sign in immediately.
- For production, decide whether email confirmation should be on before launch.

## Step 5 - Configure Password Recovery Redirects

In Supabase Dashboard -> Authentication -> URL Configuration -> Redirect URLs,
add:

- Production: `batavasa://reset-password`
- Dev: the Expo Go `exp://.../--/reset-password` URL printed by the dev server

Without these redirect URLs, password recovery links may fall back to the Site URL
and fail to return to the app.

## Step 6 - Configure Sync Tables And RLS

Auth alone is not enough for cloud sync. For sync, run:

```text
docs/supabase-setup.sql
```

in the Supabase SQL Editor for the target project.

Then verify B1/B2 behavior with:

```text
docs/b1-b2-verification.md
```

## Troubleshooting

| Symptom | Likely fix |
|---|---|
| App says sign-in is unavailable | Check `.env.local`, variable names, and Expo restart with `-c`. |
| Sign-up works but sign-in fails immediately | Email confirmation may be enabled; confirm the email or disable confirmation for dev. |
| Password reset opens browser instead of app | Add the correct redirect URL in Supabase auth settings. |
| Web session does not persist | Avoid private browsing and check localStorage availability. |
| Supabase sync fails after login | Run `docs/supabase-setup.sql` and check RLS policies. |
