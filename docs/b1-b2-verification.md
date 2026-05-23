# B1/B2 Auth And Sync Verification

Use this checklist before public launch. Run it against the real Supabase project and a device/emulator build, not only Jest.

## 0. Local Preflight

```powershell
npx tsc --noEmit
npm test -- --runInBand
```

Check required env values are present:

```powershell
Select-String -Path .env.local -Pattern "EXPO_PUBLIC_SUPABASE_URL|EXPO_PUBLIC_SUPABASE_ANON_KEY"
```

Start the app:

```powershell
npm run android
```

or:

```powershell
npm run ios
```

Web can be useful for quick checks, but Auth/Sync sign-off should be on native:

```powershell
npm run web
```

### Android SDK / ADB Troubleshooting

If `npm run android` fails with:

```text
Failed to resolve the Android SDK path
'adb' is not recognized
```

then Android SDK is not installed or not on `PATH`.

Check current machine state:

```powershell
where.exe adb
Get-ChildItem Env:ANDROID_HOME,Env:ANDROID_SDK_ROOT -ErrorAction SilentlyContinue
Test-Path "$env:LOCALAPPDATA\Android\Sdk"
```

Install/fix:

1. Install Android Studio.
2. Open Android Studio -> SDK Manager.
3. Install:
   - Android SDK Platform
   - Android SDK Platform-Tools
   - Android Emulator
4. Confirm SDK path, usually:

```text
C:\Users\Admin\AppData\Local\Android\Sdk
```

Set environment variables for the current PowerShell session:

```powershell
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT="$env:ANDROID_HOME"
$env:Path="$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:Path"
where.exe adb
adb version
```

Persist them for future terminals:

```powershell
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
[Environment]::SetEnvironmentVariable("ANDROID_SDK_ROOT", "$env:LOCALAPPDATA\Android\Sdk", "User")
[Environment]::SetEnvironmentVariable("Path", "$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:LOCALAPPDATA\Android\Sdk\emulator;" + [Environment]::GetEnvironmentVariable("Path", "User"), "User")
```

Close and reopen PowerShell/IDE, then retry:

```powershell
where.exe adb
npm run android
```

## 1. Supabase Setup

1. Open the production Supabase project.
2. Run [supabase-setup.sql](supabase-setup.sql) in the Supabase SQL editor.
3. Confirm tables exist:
   - `finance_transaction`
   - `finance_category`
   - `finance_rule`
   - `reminder`
   - `habit`
   - `habit_log`
   - `journal`

Supabase SQL checks:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'finance_transaction',
    'finance_category',
    'finance_rule',
    'reminder',
    'habit',
    'habit_log',
    'journal'
  )
order by table_name;
```

Confirm RLS is enabled:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'finance_transaction',
    'finance_category',
    'finance_rule',
    'reminder',
    'habit',
    'habit_log',
    'journal'
  )
order by tablename;
```

## 2. Auth Verification

Test with a fresh account.

1. Open app signed out.
2. Confirm login wall blocks module data.
3. Sign up with email/password.
4. Confirm user lands in the app.
5. Kill and reopen the app.
6. Confirm session restores without signing in again.
7. Sign out.
8. Confirm login wall returns.
9. Sign back in.

Expected:

- No white screen.
- No module data visible while signed out.
- Existing local data reloads after session restore.
- Supabase warning about missing env must not appear when `.env.local` is configured.

## 3. Per-Module Sync Matrix

Run this matrix for each module.

| Module | Create | Update | Delete | Wipe | Supabase table |
|---|---:|---:|---:|---:|---|
| Finance transaction | [ ] | [ ] | [ ] | [ ] | `finance_transaction` |
| Finance category/rule | [ ] | [ ] | [ ] | [ ] | `finance_category`, `finance_rule` |
| Reminder | [ ] | [ ] | [ ] | [ ] | `reminder` |
| Habit | [ ] | [ ] | [ ] | [ ] | `habit`, `habit_log` |
| Journal | [ ] | [ ] | [ ] | [ ] | `journal` |

Supabase row checks:

```sql
select id, user_id, updated_at, deleted_at, synced_at
from reminder
order by updated_at desc
limit 20;
```

Repeat by replacing `reminder` with:

```sql
finance_transaction
finance_category
finance_rule
habit
habit_log
journal
```

Expected:

- Synced rows have the signed-in `user_id`.
- Updates change `updated_at`.
- Soft-delete operations set `deleted_at` where the table uses soft delete.
- Wipe removes remote rows for the current user only.

## 4. Sync Toggle Verification

For each settings toggle:

1. Turn the module sync toggle off.
2. Create or update one item in that module.
3. Confirm the item remains local.
4. Confirm the Supabase row does not change while disabled.
5. Turn the toggle on.
6. Foreground the app.
7. Confirm the queued item syncs.

Use Supabase SQL to inspect target tables. If needed, add temporary console logging around `services/sync.ts`, then remove it before commit.

## 5. Offline Queue Verification

1. Sign in while online.
2. Turn network off on the device/emulator.
3. Create one item in each module:
   - Finance transaction
   - Reminder
   - Habit log
   - Journal entry
4. Kill and reopen the app while still offline.
5. Confirm local data is still visible.
6. Turn network on.
7. Foreground the app.
8. Confirm queued rows arrive in Supabase.

Expected:

- No data loss after app restart.
- Queue drains on foreground.
- Duplicate queue entries do not produce duplicate remote rows.

## 6. B1/B2 Automated Diagnostic

Run after `.env.local` is configured and app dependencies are installed:

```powershell
npm test -- --runTestsByPath __tests__\b1b2.test.ts --runInBand
```

Interpretation:

- If Supabase env is missing, the diagnostic will report auth disabled.
- If env is present but no session exists in the test runtime, manual app verification is still required.
- Passing Jest is not enough for B1/B2 sign-off; the manual device matrix above is required.

## 7. Sign-Off Criteria

B1/B2 can be marked verified only when:

- Auth sign up/sign in/sign out/session restore pass on native.
- All module create/update/delete/wipe paths sync to Supabase.
- Per-module toggles stop and resume sync correctly.
- Offline create plus later foreground/network restore drains the queue.
- No cross-user rows are visible or writable under RLS.
