# Auth Setup - Supabase

> One-time setup for a local/dev/prod Supabase project. The app uses a login wall
> and Supabase email/password auth.

## What Auth Currently Uses

- Supabase Auth.
- Email/password sign up and sign in.
- **Native Google Sign-In** on iOS/Android (system account picker → ID token →
  `supabase.auth.signInWithIdToken`). No browser/custom-tab redirect.
  - Web (and any build without a Google client ID configured) falls back to the
    OAuth browser-popup flow via the app callback route.
- In-app password recovery through deep links.
- Auth email delivery (recovery, confirmation) via **custom SMTP — Resend**
  (configured in the Supabase dashboard, not in app code; see Step 4b).
- Session persistence through `services/supabase.ts` and the secure storage
  wrapper.
- Login wall before using the app.

Native Google Sign-In requires a **development/EAS build** — it does not work in
Expo Go (which is already true for this app's other native modules). Anonymous
mode and account deletion Edge Functions are not implemented yet; see
`docs/security.md`.

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
- Ensure Google provider is enabled before testing Google Auth.
- For local development, you may turn email confirmation off so test accounts can
  sign in immediately.
- For production, decide whether email confirmation should be on before launch.

By default Supabase sends auth emails (confirmation, password recovery, magic
links) from its **shared built-in service**, which is heavily rate-limited
(~2-3 emails/hour) and only meant for testing. For real password-recovery
delivery, configure custom SMTP via Resend (Step 4b).

## Step 4b - Configure Custom SMTP (Resend)

All Supabase auth emails — including the **password reset** mail — are sent
server-side by Supabase, not by the app. So switching from Supabase's built-in
sender to Resend is a dashboard-only change; **no app code changes**, and the
`batavasa://reset-password` deep link keeps working as-is.

> ⚠️ The Resend API key is a **server-side secret**. It goes ONLY into the
> Supabase dashboard. Never put it in `.env.local`, `eas.json`, or any
> `EXPO_PUBLIC_*` variable — those ship to the client bundle.

### 1. Set up a sending domain in Resend

1. Create an account at <https://resend.com>.
2. Resend Dashboard -> Domains -> Add Domain (e.g. `batavasa.com` or a subdomain
   like `mail.batavasa.com`).
3. Add the DNS records Resend shows (SPF/`TXT`, DKIM/`TXT`, and the `MX` record on
   the send subdomain; DMARC optional but recommended) at your DNS provider.
4. Wait for the domain status to turn **Verified**.

For a quick test before owning a domain, Resend's `onboarding@resend.dev` sender
works but can only deliver to your own Resend account email — not for production.

### 2. Create a Resend API key

Resend Dashboard -> API Keys -> Create API Key:

- Permission: **Sending access**.
- Optionally scope it to the verified domain.
- Copy the key (`re_...`) — this is the SMTP **password**.

### 3. Enable Custom SMTP in Supabase

Supabase Dashboard -> Project Settings -> Authentication -> SMTP Settings ->
enable **Custom SMTP**, then enter:

| Field | Value |
|---|---|
| Sender email | e.g. `noreply@batavasa.com` (must be on the verified Resend domain) |
| Sender name | e.g. `BataVasa` |
| Host | `smtp.resend.com` |
| Port | `465` (TLS) — or `587` for STARTTLS |
| Username | `resend` |
| Password | your Resend API key (`re_...`) |

Save. Send a test from Supabase if the UI offers it.

### 4. Raise the auth email rate limit

Once on custom SMTP you are no longer bound by the built-in cap. Supabase
Dashboard -> Authentication -> Rate Limits -> raise "emails per hour" to a value
that fits expected signup/recovery volume (Resend free tier allows 100 emails/day,
3,000/month — confirm your plan covers production traffic).

### 5. (Optional) Customize the reset template

Supabase Dashboard -> Authentication -> Email Templates -> **Reset Password**.
Keep the `{{ .ConfirmationURL }}` token — it carries the recovery code and resolves
to the redirect URL configured in Step 5 (`batavasa://reset-password`). Custom SMTP
does not change templates; it only changes the delivery transport.

## Step 4c - Configure Native Google Sign-In

Native sign-in uses `@react-native-google-signin/google-signin` and exchanges a
Google **ID token** for a Supabase session. You need OAuth client IDs from Google
Cloud Console (the same Google project linked to Supabase's Google provider).

### Create OAuth client IDs

In Google Cloud Console -> APIs & Services -> Credentials -> Create credentials
-> OAuth client ID:

1. **Web client** — type "Web application". This is the `webClientId` the app and
   Supabase both validate against. Required on every platform.
2. **Android client** — type "Android". Package name `com.batavasa.app` (matches
   `app.json` -> `android.package`). Add the **SHA-1** of the signing key:
   - Dev/EAS internal builds: run `eas credentials` (Android -> Keystore) to read
     the SHA-1, or `keytool -list -v -keystore <debug.keystore>`.
   - Production: use the Play App Signing SHA-1 from the Play Console.
3. **iOS client** (only if you ship iOS) — type "iOS", bundle ID matching the iOS
   build. Copy its **reversed client ID** (`com.googleusercontent.apps.XXXX`).

### Wire client IDs into the app

Add to `.env.local` (and to `eas.json` build `env` for preview/production):

```env
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=xxxx.apps.googleusercontent.com
# iOS only:
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=yyyy.apps.googleusercontent.com
```

When `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is absent, sign-in silently falls back to
the OAuth browser flow, so dev builds without it still work.

For **iOS**, also replace the placeholder in `app.json` -> plugins ->
`@react-native-google-signin/google-signin` -> `iosUrlScheme` with the reversed
iOS client ID. Android ignores this value.

### Tell Supabase to trust the ID tokens

In Supabase Dashboard -> Authentication -> Providers -> Google, under **Authorized
Client IDs**, add the **Web client ID** (and the iOS client ID if used). Without
this, `signInWithIdToken` rejects the token with "Invalid audience".

### Rebuild — config plugin needs native code

The library ships native code, so a JS reload is not enough. Rebuild the dev
client / app after installing it and editing `app.json`:

```bash
npx expo prebuild --clean   # if you keep native folders
eas build --profile development --platform android
```

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
| Reset/confirmation email never arrives | Built-in sender is rate-limited — set up Resend custom SMTP (Step 4b); verify the Resend domain is **Verified** and the API key has sending access. |
| Resend SMTP rejects send / "domain not verified" | Sender email must be on a verified Resend domain; finish the DNS (SPF/DKIM/MX) records and wait for verification. |
| Emails stop after a few sends | Raise the auth email rate limit (Step 4b.4) and check the Resend plan's daily/monthly quota. |
| Password reset opens browser instead of app | Add the correct redirect URL in Supabase auth settings. |
| Google still opens a browser instead of the native picker | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` missing, or running an old build — set it and rebuild the dev client. |
| Native Google fails with "Invalid audience" / token rejected | Add the Web (and iOS) client ID to Supabase Google provider -> Authorized Client IDs. |
| Android Google fails with `DEVELOPER_ERROR` (code 10) | SHA-1 / package name not registered in the Android OAuth client, or wrong signing key for this build. |
| Web session does not persist | Avoid private browsing and check localStorage availability. |
| Supabase sync fails after login | Run `docs/supabase-setup.sql` and check RLS policies. |
