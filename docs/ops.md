# Operations

> Deploy, env vars, testing, performance, monitoring.

## Environment Variables

| Var | Purpose | Where |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL | client |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | client |
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry DSN (public) | client |
| `EXPO_PUBLIC_ENV` | `dev` / `preview` / `prod` | client |
| `OPENAI_API_KEY` | OpenAI API key | **server-only** (Supabase Edge Function secret) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key | **server-only** |
| `SQLCIPHER_KEY_PEPPER` | App-level pepper mixed with device key | client (compiled, not env) |
| `EAS_PROJECT_ID` | EAS build project | CI/EAS |

**Native permissions (declared in `app.json`):**
- iOS `NSLocationWhenInUseUsageDescription` — required by `expo-location` (Cross-Module Rule 6)
- Android `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION` — same
- Always request lazily at runtime when user opts in via Settings — never at startup

- `.env.local` for dev, `.env.production` for prod build
- Never commit `.env*`

## Build & Deploy

- **Dev:** `npx expo start`
- **Preview:** EAS Build preview channel (`eas build --profile preview`)
- **Production:** `eas build --profile production` + `eas submit`

**Release process:**
1. Cut release branch from `main`: `release/x.y.z`
2. Bump `version` in `app.json` (semver: patch/minor/major)
3. Bump `ios.buildNumber` and `android.versionCode` (monotonic integer)
4. Run full test suite + manual smoke (see checklist below)
5. `eas build --profile production --platform all`
6. Submit to stores: `eas submit --profile production --platform all`
7. Tag commit: `git tag v<x.y.z>` and push
8. Merge release branch back to `main`

## Testing (mandatory — Cross-Module reliability)

Tests are a hard requirement before any module ships to beta. Without them, refactor is gambling and bug regression is invisible.

- **Unit:** Jest (services, hooks logic, pure functions)
- **Component:** React Native Testing Library
- **E2E:** **Maestro** (chosen — YAML flows, easier than Detox, no native build step)
- **Coverage targets:**
  - `services/` and `database/` → **70% statements** (hard gate in CI)
  - Pure helpers (`services/ai/smartEntry.ts:extractAmount`, `services/dateParser.ts`, currency helpers) → **90%**
  - UI → optional but recommended for forms with validation

Run: `npm test` · CI: `npm run test:ci` (fails on coverage regression) · E2E: `maestro test .maestro/`

**Per-module required test surface:**
- Services: all `Result` branches (happy + error path for every public function)
- DB layer: round-trip insert/query/update/soft-delete + migration up/down
- Sync engine: conflict scenarios per table policy
- AI: prompt builders (deterministic snapshot) + response parser (against fixture JSON, including malformed)
- E2E (Maestro): create entry, edit, delete, wipe — happy path for each module

**Fixtures:** keep small JSON in `__fixtures__/` next to the test. Never hit live AI / Supabase in CI.

## Performance Rules

- Bundle size budget: **< 30 MB** (Android), **< 50 MB** (iOS) — measure via `eas build`
- JS bundle: **< 5 MB** uncompressed (excluding fonts, images)
- Cold start target: **< 2s** on mid-range device (Android Pixel 5 baseline)
- Sync engine backoff: `1s → 2s → 4s → 8s → 30s → slow-poll (5min)`
- AI calls: debounce 500ms + dedupe in-flight + cache by `data_hash` (see `docs/ai-integration.md`)
- Lists > 50 items: virtualize with `FlashList` (preferred over `FlatList` for perf)
- Images: lazy + `expo-image` with `cachePolicy="memory-disk"`
- Avoid re-renders: memoize selectors, prefer `subscribe` over `useStore(state => ...)` for non-reactive reads

## Monitoring

- **Crash reporting:** Sentry (`@sentry/react-native`) — auto-capture unhandled errors + manual `Sentry.captureException` in service `Result` errors
- **Performance metrics:** Sentry Performance — trace cold start, screen transitions, sync round-trip, AI call latency

**Analytics events** (PostHog or Supabase analytics table):

Track:
- `app_open`, `app_background`
- `auth_signup`, `auth_login`, `auth_logout`
- `transaction_created` (no amount, no merchant — only `category_kind`, `source`)
- `insight_generated` (`module`, `kind`, `cache_hit`)
- `sync_failed` (`table`, `error_code`)
- `feature_used` (`feature_name`) for new features (opt-in via flag)

**Never track:**
- Transaction amounts, merchants, notes
- Journal content, mood values
- Any PII (email, name, exact location)
- Anything raw from `journal_entry.body`

## Bug Tracking

- GitHub Issues for tracked bugs
- Critical bugs: tag `priority:critical` → triage within 24h

## Release Checklist

- [ ] All tests pass
- [ ] No new console.errors in dev
- [ ] Migrations tested on prod-like data
- [ ] Env vars set in EAS
- [ ] Bumped `version` in `app.json`
- [ ] Changelog updated (use git log, not a separate file)
- [ ] Smoke test on physical device
