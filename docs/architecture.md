# Architecture

## System Overview

```
┌─────────────────────────────────────────┐
│  React Native (Expo) UI                 │
├─────────────────────────────────────────┤
│  Hooks (React state, business glue)     │
├─────────────────────────────────────────┤
│  Services (pure business logic)         │
├─────────────────────────────────────────┤
│  Database (SQLite) ↔ Sync ↔ Supabase    │
│  AI Services (OpenAI)                   │
└─────────────────────────────────────────┘
```

## Design Principles

- **Feature-modular** — each domain (finance, habits, journals) is self-contained
- **Offline-first** — SQLite is source of truth, Supabase is mirror
- **Separation of concerns** — UI never imports DB directly

## Module Map

Each module follows the same shape:

```
features/<module>/
  screens/             ← React Native screens
  components/          ← module-specific components
  hooks/               ← state + glue hooks

store/<module>Store.ts ← Zustand/Redux store

database/<module>/
  schema.ts            ← SQLite table defs
  queries.ts           ← typed query functions
  sync.ts              ← Supabase mirror logic

ai/<module>Insight.ts  ← AI analysis for this module
```

### Current Modules

| Module | Status | UI | Store | DB | AI |
|---|---|---|---|---|---|
| **Finance** | ✅ Built | `features/finance/screens/` | `store/financeStore.ts` | `database/finance/` | `services/ai/financeInsight.ts` |
| **Reminders** | ✅ Built | `features/reminders/screens/` | `store/remindersStore.ts` | `database/reminders/` | _(none — pure CRUD)_ |
| **Journals** | ✅ Built | `features/journals/screens/` | `store/journalsStore.ts` | `database/journals/` | _(planned — Journal Reflection)_ |
| **Habits** | ⬜ Planned | — | — | — | _(planned)_ |
| **Home (Daily Digest)** | ✅ Built | `features/home/screens/DailyDigestScreen.tsx` | _(reads from all module stores)_ | — | — |

## Data Flow

### Manual entry (form)

1. User opens form → fills fields → tap Save
2. UI calls a hook (`useFinanceCreate()`)
3. Hook calls service (`financeService.create()`)
4. Service validates (zod) → writes to SQLite (sync) → queues Supabase sync (async)
5. AI insights regenerated via `ai/<module>Insight.ts` on schedule or event

### AI-parsed entry (Universal Add Sheet)

1. User taps **+** FAB on home screen → `UniversalAddSheet` opens (`features/home/components/UniversalAddSheet.tsx`)
2. User types free text (voice planned for V2)
3. Text goes through **deterministic pre-parser** (`services/ai/smartEntry.ts:extractAmount`) for amount extraction
4. Pre-parsed text → `services/ai/universalEntry.ts:parseUniversalEntry()` → AI intent classifier → returns typed `UniversalEntry`
5. Prompt includes: language directive, current local datetime, user timezone offset (so "18h00" → `18:00+07:00` not `18:00Z`)
6. **Confirmation sheet** shown inline (module icon, parsed fields, Save/Edit/Cancel)
7. On Save → calls the appropriate module's store action (`createTransaction` / `createReminder` / …)
8. `settingsStore.aiAutoConfirm` toggle (default `true`) controls whether sheet is shown; voice always confirms

## Cross-Module Rules

All 5 rules defined in `CLAUDE.md`. Implementation specifics below.

### Rule 1 — Cloud sync + Wipe

**Per-module sync toggle**

- Stored in `settingsStore.moduleSync[<module>]: boolean`, default `true`
- When `false`: writes still go to SQLite + `sync_queue`, but the sync worker skips `<module>_*` tables
- UI: Settings → `<Module> data` sub-screen → toggle

**"Delete all data" action**

Every module exports from `features/<module>/services.ts`:
```ts
export async function wipeAllData(): Promise<Result<{ deleted: number }, AppError>>
```

Behavior:
1. Hard delete from SQLite (`DELETE FROM <module>_*` — not soft)
2. Insert tombstone op into `sync_queue` so Supabase cleans up on next sync
3. Clear in-memory store state
4. Return count for confirmation toast

UI: `features/settings/screens/<Module>DataScreen.tsx` → destructive button with double-confirm

### Rule 2 — Language applies everywhere (including AI)

- UI strings: `services/i18n/translations/<lang>.ts` — 6 locales
- AI: every prompt builder MUST start with:
  ```ts
  const language = getAILanguage()  // returns "Vietnamese", "English", ...
  const systemPrompt = `Respond in ${language}. ${rest...}`
  ```
- Adding new translation keys: update **all 6** files in same commit. Missing keys default to `en` at runtime (graceful) but flag as warning in `__DEV__`

### Rule 3 — Universal "Add Activity"

**Implemented:** `features/home/components/UniversalAddSheet.tsx` — bottom sheet Modal on DailyDigestScreen.

**Intent classifier:** `services/ai/universalEntry.ts:parseUniversalEntry(text)`

```ts
export type UniversalEntry =
  | { module: 'finance';  amount_cents, direction, category_hint, merchant, note, occurred_at }
  | { module: 'reminder'; title, remind_at, recurrence, note }
  | { module: 'habits';   title, frequency }
  | { module: 'journal';  content }
```

- AI classifies via `chatCompletion()` (multi-provider) at `temperature: 0.1`
- `extractAmount()` runs deterministically before AI call; enforced if AI result diverges ≥10×
- All datetimes include user timezone offset in prompt and post-processed via `fixReminderTimezone()` to prevent UTC-vs-local bugs
- Habits/Journal from sheet: classified and summarized, but save goes directly to module form (full CRUD screens handle the actual write)

**Voice:** planned for V2 — will wrap `expo-speech-recognition` behind `services/voice.ts`

### Rule 4 — Backdated entries

**Schema**

Every module's main table has:
- `occurred_at TEXT NOT NULL` — user-meaningful event time (editable)
- `created_at TEXT NOT NULL` — system insert time (immutable)

Already enforced in `finance_transaction`, `habit_log`, `journal_entry`, `reminder`.

**Date pre-parser** — shared at `services/dateParser.ts`:

```ts
export function parseDate(text: string, now = new Date()): Date | null
```

Handles (Vietnamese + English):
| Phrase | Resolves to |
|---|---|
| `hôm nay`, `today`, `bữa nay` | start of today |
| `hôm qua`, `yesterday` | start of yesterday |
| `hôm kia`, `day before yesterday` | -2 days |
| `tuần trước`, `last week` | -7 days |
| `tháng trước`, `last month` | -1 month |
| `ngày 13/2`, `13/2`, `13 tháng 2` | this/last year's Feb 13 |
| `ngày 13/2/2023`, `13/2/2023`, `2023-02-13` | absolute |
| `sáng nay`, `this morning` | today 08:00 |
| `tối qua`, `last night` | yesterday 20:00 |

Returns `null` if no match → caller defaults to `now`.

**Date picker UI**

Every module's create/edit screen exposes a **date row** (tappable → opens `@react-native-community/datetimepicker`). Default = now, but pre-filled from `parseDate(text)` if AI route.

**AI prompts**

System prompt MUST include:
```
Today is ${new Date().toISOString().slice(0, 10)} (${dayName}).
User's relative dates ("tomorrow", "hôm qua") should resolve against this.
```

### Rule 5 — AI parse → confirm before save

**Implemented** inside `features/home/components/UniversalAddSheet.tsx` as the Step 2 UI after `parseUniversalEntry()` returns.

Layout (Step 2):
```
┌─ Bạn nói: ─────────────────────────┐
│ "hôm qua tôi nhậu hết 500k"        │
├─────────────────────────────────────┤
│ 💰 Tài chính                        │
│ - 500.000 ₫ · Ăn uống · hôm qua    │
├─────────────────────────────────────┤
│ [ Cancel ]  [ Edit ]  [ Save ✓ ]    │
└─────────────────────────────────────┘
```

**Settings:**
- `settingsStore.aiAutoConfirm: boolean` (default `true` = step 2 shown)
- "Edit" → resets to Step 1 (text input) with same text pre-filled
- "Save" → calls module store action directly (no navigation)

**Voice exception:** even if `aiAutoConfirm === false`, voice inputs ALWAYS show the sheet (speech-to-text errors are common). _Voice planned V2._

### Rule 7 — CRUD completeness

Every entry-type table (`finance_transaction`, `habit_log`, `journal_entry`, `reminder`, …) MUST have a complete UI lifecycle.

**Service signatures (mandatory):**
```ts
async function getX(id: string): Promise<Result<X, AppError>>
async function createX(input: CreateXInput): Promise<Result<X, AppError>>
async function updateX(input: UpdateXInput): Promise<Result<X, AppError>>
async function deleteX(id: string): Promise<Result<void, AppError>>
```

**Screen pattern:** one screen for create + edit. The route accepts an optional `id` param:
- `/<module>/new` → blank create form
- `/<module>/new?id=abc` → same screen, pre-filled from `getX(abc)`, calls `update` on save, shows Delete button

**List interaction:**
- Primary tap → opens detail/edit screen
- Long-press → soft-delete (with toast undo for 5s, then commit)
- Swipe gesture optional

**Why one screen, not two:** cuts code by ~50%, single source of truth for validation + layout, the only diff is mode flag.

### Rule 8 — Error boundaries + observability

Reliability is a feature. No silent failures, no white screens.

**Required setup:**
- Sentry init in `app/_layout.tsx` BEFORE any provider mount
- Top-level `Stack` provides one `<ErrorBoundary>` for the whole app
- Per-screen `<ErrorBoundary>` for risky areas (AI fetch, image processing, sync drain)
- Boundary fallback: themed message + retry + report button → opens bug-report mailto / GitHub issue prefilled with breadcrumbs

**Service-layer contract:**
- Every async returning `Result.err` MUST surface to user (toast / alert / sheet)
- Logger `warn`/`error` levels auto-forward to Sentry
- PII scrub list in `services/logger.ts` is the ONLY source of truth — extend it when adding new sensitive fields

**Analytics:**
- `services/analytics.ts` wraps PostHog (or chosen provider)
- Allow-list events in `docs/ops.md` — never track amounts, content, exact locations
- Performance tracing: cold-start, screen transitions, sync round-trip, AI call latency

### Rule 6 — Location (optional, GPS-default, clear-to-empty)

**Schema** — every entry table adds 3 nullable columns:
```sql
location_lat   REAL    -- WGS84 latitude
location_lng   REAL    -- WGS84 longitude
location_label TEXT    -- reverse-geocoded or user-typed
```

All three are independently nullable: a user may type a label without GPS, or have GPS without geocoding.

**Service** — `services/location.ts` (cross-platform wrapper):
```ts
export async function getCurrentLocation(): Promise<{ lat: number; lng: number; label: string | null } | null>
export async function reverseGeocode(lat: number, lng: number): Promise<string | null>
export async function requestLocationPermission(): Promise<boolean>
```

Implementation:
- Native: `expo-location` — `requestForegroundPermissionsAsync()` + `getCurrentPositionAsync()` + `reverseGeocodeAsync()`
- Web: `navigator.geolocation.getCurrentPosition()` (no built-in reverse geocode — return `null` label)
- ALL paths handle permission denial / unavailable hardware by returning `null` (never throw to UI)

**Settings** — `settingsStore.locationAccess: boolean` (default `false`)
- Settings → Privacy → "Allow location" toggle
- When user toggles ON for the first time, immediately request OS-level permission
- When OFF, skip GPS entirely (don't prompt OS, don't fetch)

**UI pattern** — `<LocationRow>` shared component:
```tsx
<LocationRow
  value={locationLabel}                    // string | null
  onChange={setLocationLabel}
  autoFetch={settings.locationAccess}      // fetch current location on mount if true
/>
```

Behavior:
- On mount: if `autoFetch === true` && `value === null` → call `getCurrentLocation()` → set `value` to returned label
- Tappable → opens text input for manual edit
- "Clear" (×) button → sets `value` to empty string (treated as null at save)
- At save: empty string → `null` for all three columns (respect user intent — don't persist GPS the user cleared)

**Privacy:**
- `services/logger.ts` PII scrub list includes `location_lat`, `location_lng`, `location_label`
- Never include raw coords in AI prompts; pass `location_label` only, OR round coords to 0.01° (~1km) if needed
- Wipe operation (Rule 1) MUST null out location columns alongside other deletes

## Cross-cutting Concerns

### State Management

- **Zustand** for module stores — one store per feature (`financeStore`, `habitStore`, …)
- Stores hold **derived/cached state only** — SQLite remains source of truth
- Store actions call services, never DB directly
- Persist UI preferences (theme, last-viewed tab) via `zustand/middleware/persist` → AsyncStorage
- Never persist domain data in Zustand — it lives in SQLite

### Error Handling

- **Boundary:** `<ErrorBoundary>` wraps each tab navigator → fallback screen + "report" button
- **Service layer:** all services return `Result<T, AppError>` (discriminated union, no thrown errors across module boundaries)
- **Sync errors:** never bubble to UI — logged + retried (see `docs/sync-offline.md`)
- **AI failures:** degrade gracefully — show last cached insight + "couldn't refresh" hint

### Logging

- **Dev:** `console.log` allowed, gated by `__DEV__`
- **Prod:** Sentry breadcrumbs only; never `console.log` PII
- Use `services/logger.ts` wrapper — strips PII, tags by module
- Levels: `debug` (dev only) · `info` · `warn` · `error` (auto-reports to Sentry)
