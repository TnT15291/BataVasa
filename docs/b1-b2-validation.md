# B1 & B2 Runtime Validation Plan

> Supabase Auth (B1) + Cloud Sync (B2) end-to-end verification

**Status**: Draft validation checklist  
**Target**: Confirm auth + sync work correctly in dev + prod flows

---

## B1: Supabase Auth Runtime Verification

### Prerequisites
- `.env.local` has `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Supabase project exists with auth enabled
- At least one test user or signup enabled

### Test scenarios

#### B1.1: App boots without session
**Flow:**
1. Fresh app install or signed out
2. Launch app
3. Check: AuthScreen appears (email/password login form)
4. Check: AuthScreen shows "backend not configured" message ONLY if env vars missing

**Expected:**
- AuthScreen visible, no crash
- Login/signup form responsive

#### B1.2: Sign up flow
**Flow:**
1. On AuthScreen, switch to "Sign up" mode
2. Enter email (e.g., `test.onboarding@example.com`)
3. Enter password (≥6 chars)
4. Tap "Sign up"

**Expected:**
- If email confirmation required: success toast + "check email" message
- If auto-confirmed: session persists, navigates to home screen
- `busy` spinner shows while request in flight

#### B1.3: Sign in flow (after sign up)
**Flow:**
1. Use credentials from B1.2 (or create new test account via Supabase console)
2. On AuthScreen, stay in "Sign in" mode
3. Enter email + password
4. Tap "Sign in"

**Expected:**
- Session acquired, home screen appears
- Settings + module stores reload (reloadAllStores called)
- App persists session to secure storage (chunked)

#### B1.4: Session persistence across app restart
**Flow:**
1. After B1.3, force app restart (kill + relaunch)
2. Wait for app to boot (migrations, settings load, auth init)

**Expected:**
- Home screen appears immediately (no AuthScreen)
- Session still valid
- User data (if any) loads from store

#### B1.5: Sign out
**Flow:**
1. From home screen, go to Settings → Sign Out (or button TBD)
2. Tap sign out

**Expected:**
- Session cleared from memory + secure storage
- All module stores cleared (transactions, reminders, etc. → empty)
- AuthScreen appears
- Local SQLite data still intact (signing back in recovers it)

#### B1.6: Token refresh (background → foreground)
**Flow:**
1. Sign in successfully
2. Put app in background for ~5 min (or manually trigger via AppState)
3. Bring app back to foreground

**Expected:**
- Token refreshed silently
- No re-auth required
- Next API call succeeds

---

## B2: Cloud Sync End-to-End Verification

### Prerequisites
- B1 (auth) working
- Supabase project has tables: `finance_transaction`, `finance_category`, `habit`, `habit_log`, `journal`, `reminder`
- Sync toggles enabled in Settings for test module (e.g., `syncFinance = true`)

### Test scenarios

#### B2.1: Transaction enqueued on create
**Flow:**
1. Sign in (B1.3)
2. Go to Finance
3. Add transaction: "Lunch 50k"
4. Check SQLite sync queue table

**Expected:**
- `sync_queue` has new row with:
  - `operation = 'upsert'`
  - `table_name = 'finance_transaction'`
  - `row_id = <transaction_id>`
  - `synced_at = null`

#### B2.2: Queue drained on app ready
**Flow:**
1. After B2.1, watch `sync_queue` via SQLite browser
2. Wait ~2-3 seconds (or trigger drainQueue manually)

**Expected:**
- Queue item `synced_at` set to current timestamp
- Supabase table `finance_transaction` has new row with user_id + transaction data

#### B2.3: Sync respects module toggles
**Flow:**
1. Settings → Finance → disable "Cloud Sync" toggle (`syncFinance = false`)
2. Add another transaction
3. Check queue

**Expected:**
- Transaction enqueued
- drainQueue runs but SKIPS this item (toggleKey check)
- Item stays with `synced_at = null`
- Re-enable sync, wait for drain: item synced

#### B2.4: Multiple tables sync
**Flow:**
1. Re-enable Finance sync
2. Add: transaction + custom category + habit log + journal entry + reminder
3. Wait for drain

**Expected:**
- All 5 items synced to their respective Supabase tables
- Queue shows all processed

#### B2.5: Sync handles failures gracefully
**Flow:**
1. Simulate network failure (airplane mode or disconnect WiFi/LTE)
2. Add transaction
3. Watch sync attempt

**Expected:**
- drainQueue logs error
- Item marked as failed (`status = 'failed'`, `error_msg` set)
- Next successful sync retries item

#### B2.6: Delete (wipe) queued correctly
**Flow:**
1. Settings → Finance → "Delete all data"
2. Tap confirm "Delete"
3. Check sync queue

**Expected:**
- Queue has item with `operation = 'wipe'`, `table_name = 'finance_transaction'`
- drainQueue sends `DELETE FROM finance_transaction WHERE user_id = ?`
- Supabase confirms deletion
- Local SQLite transactions cleared (but schema remains)

#### B2.7: Pull/merge from cloud (future)
**Note:** Pull logic not yet implemented.  
Placeholder for bi-directional sync validation once backend conflicts resolved.

---

## Manual Testing Checklist

### Setup
- [ ] `.env.local` configured with valid Supabase keys
- [ ] Supabase project has all required tables
- [ ] Test user created or signup enabled

### B1 Tests
- [ ] B1.1 AuthScreen appears on first launch
- [ ] B1.2 Sign up works (with/without confirmation)
- [ ] B1.3 Sign in works
- [ ] B1.4 Session persists after restart
- [ ] B1.5 Sign out clears state
- [ ] B1.6 Token refresh in background

### B2 Tests
- [ ] B2.1 Transaction → sync queue
- [ ] B2.2 Queue drained → Supabase
- [ ] B2.3 Sync toggle respected
- [ ] B2.4 Multiple tables synced
- [ ] B2.5 Failures handled
- [ ] B2.6 Wipe operation synced

---

## Automated Test Sketch (Future)

```typescript
// __tests__/supabase.auth.test.ts
describe('B1: Supabase Auth', () => {
  it('should show AuthScreen when no session', async () => {
    // Clear session from secure storage
    // Boot authStore.init()
    // Assert useAuthStore.getState().session === null
    // Assert configured === true (or false if env missing)
  })

  it('should persist session to chunked secure storage', async () => {
    // Call authStore.signIn()
    // Check secure storage has keys: `supabase.session.0`, `.1`, `.meta`
  })

  it('should reload stores on sign-in', async () => {
    // Mock supabase.auth.onAuthStateChange to emit SIGNED_IN
    // Assert reloadAllStores called
  })
})

// __tests__/sync.test.ts
describe('B2: Cloud Sync', () => {
  it('should enqueue transaction on create', async () => {
    // Create finance transaction
    // Query sync_queue
    // Assert row with operation='upsert', table_name='finance_transaction'
  })

  it('should respect sync toggles', async () => {
    // Disable syncFinance
    // Create transaction
    // Mock drainQueue
    // Assert item skipped
  })
})
```

---

## Debugging Tips

### Check auth state
```typescript
const session = useAuthStore.getState().session
console.log('Session user:', session?.user?.email)
console.log('Access token:', session?.access_token?.slice(0, 20) + '...')
```

### Check sync queue
```typescript
const db = await getDb()
const pending = await db.getAllAsync('SELECT * FROM sync_queue WHERE synced_at IS NULL')
console.log('Pending items:', pending)
```

### Manually drain queue
```typescript
import { drainQueue } from '@services/sync'
await drainQueue()
```

### Check Supabase directly
```
# Via Supabase dashboard:
- Look at "SQL Editor" for tables
- Check user_id, created_at, synced_at
- Verify row counts after sync
```

### Logs
- Enable Sentry or grep `logger.info(MODULE, ...)`
- Search logs for `'sync'` module messages
- Check `app/_layout.tsx` for error boundaries

---

## Success Criteria

✅ **B1 Complete** when:
- Auth screen appears on first launch
- Sign in/up works end-to-end
- Session persists across restarts
- Token refresh works in background

✅ **B2 Complete** when:
- Sync queue populates on create/update
- drainQueue processes queue → Supabase
- Sync respects module toggles
- Wipe operation deletes from cloud
- Errors logged, not silent fails
