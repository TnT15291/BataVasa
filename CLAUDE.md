# BataVasa — AI-Powered Personal OS

> Foundation context. Auto-loaded every conversation. Keep concise — detail belongs in `docs/`.

## Product

AI-powered personal operating system. Modules:
- **Finance** (primary) — track spending/income, weekly/monthly/yearly reports, AI insights
- **Habits** — daily tracking + AI insights
- **Journals** — write + AI insights
- **Reminders**
- **Behavioral patterns** — cross-module correlations

**Core value:** Transform personal data into meaningful insights.

**Target users:** productivity-focused, self-improvement, ADHD, busy professionals.

**Principles:** calm UI · fast interaction · low friction · AI assists, not overwhelms.

## Finance Vision

Not just an expense tracker. Helps users:
- Understand spending behavior
- Identify unhealthy patterns
- Improve saving habits
- Correlate emotions ↔ spending
- Build long-term financial awareness

**Finance AI goals:** detect overspending, analyze emotional spending, find recurring subscriptions, compare trends, recommend actions.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React Native · Expo · TypeScript |
| Backend | Supabase |
| AI | OpenAI API |
| Storage | SQLite (local) + Supabase (cloud sync) |

## Architecture

- **Feature-based modular** architecture
- **Offline-first** design
- Business logic separated from UI

**Layers:** `UI → Hooks → Services → Database/API`

## Folder Structure

```
features/<module>/screens/   ← UI per feature
store/<module>Store.ts        ← State
database/<module>/            ← Local SQLite layer
ai/<module>Insight.ts         ← AI logic
services/                     ← Shared business logic
docs/                         ← Detailed documentation (read on-demand)
```

## Coding Conventions

- TypeScript strict mode
- Feature folders, not type folders (no `screens/`, `hooks/` at root)
- Hooks for stateful logic, services for pure logic
- Never put DB calls in UI components
- Offline-first: every write goes to SQLite first, sync to Supabase async

## Cross-Module Rules

Every domain module (Finance, Habits, Journals, Reminders, future…) MUST implement:

### 1. Cloud sync + Wipe + Export

- All user-owned data is syncable to Supabase via the shared sync engine (`docs/sync-offline.md`)
- Each module exposes 3 data-management actions in Settings → per-module sub-screen:
  1. **Sync toggle** (opt-in per module, default ON)
  2. **Export all data** — `exportAllData()` returns user's rows as JSON (or CSV per module). GDPR right-to-portability.
  3. **Delete all data** — `wipeAllData()` hard-deletes local SQLite + queues delete to Supabase
- Wipe never silent fails — always return count for user confirmation

### 2. Language applies everywhere — including AI

- The active language (`settingsStore.language`) governs:
  - All UI text (via `services/i18n`)
  - All AI prompts: system prompt MUST tell the model to respond in the active language (see `services/ai/aiLanguage.ts`)
  - All AI-generated content (insights, reports, chat replies, smart-entry parsing) returns in user's language
  - **Domain data labels** — system-seeded rows (e.g. default categories, habit templates, mood names) MUST translate via lookup, not the stored English `name` column. Pattern: keep canonical English in DB for matching/AI input stability, translate at display time. See `features/finance/i18n.ts` (`translateCategoryName`, `translateKind`).
- Never hardcode language strings in code — every user-facing string goes through `t.<key>` from `useTranslation()`
- When adding a new translation key, update ALL 6 language files (en/vi/ja/ko/fr/zh) in `services/i18n/translations/`
- User-created rows (custom categories etc.) display as-is — never translate user input
- **Locale-sensitive formatters** (dates, numbers, currencies, addresses) MUST derive locale from `settingsStore.language`, not hardcoded `'vi-VN'` or `'en-US'`:
  - `date-fns` `format()` → pass `{ locale: getDateFnsLocale(language) }` from a shared helper
  - `Intl.NumberFormat(getIntlLocale(language), …)` — never inline a locale string
  - Same for `Intl.DateTimeFormat`, `Intl.Collator`, `Intl.PluralRules`

### 3. Universal "Add Activity" entry point

The home screen has a single primary action that routes to any module:

- **One FAB button** (✨ "Add") visible on every main screen
- **Two input modes:**
  - **Text** — user types freely (e.g. "ăn trưa 50k", "30 phút chạy bộ", "nhắc mai 9h họp")
  - **Voice** — speech-to-text via device API; respects `settingsStore.language` for recognition locale
- **AI routing** — parsed text goes through an intent classifier:
  - Has amount + merchant/category-like noun → **Finance**
  - Has duration/repetition/wellness verb → **Habits**
  - Has reflection/feeling/diary keyword → **Journals**
  - Has future date/time + task → **Reminders**
- Fallback: if ambiguous, show a quick chip selector (which module?)
- Same deterministic pre-parse pattern as `smartEntry.ts` — never trust AI for arithmetic or dates

### 4. Backdated entries (every module supports past dates)

- Every entry-creating screen has a **date/time picker**, default = now
- Text/voice input MUST parse relative dates deterministically BEFORE calling AI:
  - "hôm qua", "yesterday" → `now - 1d`
  - "hôm kia", "day before yesterday" → `now - 2d`
  - "tuần trước", "last week" → `now - 7d`
  - "ngày 13/2/2023", "13/2", "Feb 13", "2023-02-13" → absolute parse via `date-fns`
  - "sáng nay", "tối qua" → date + approximate time
- Store as `occurred_at` (the event time, user-meaningful) ≠ `created_at` (system insert time)
- AI prompts MUST include current date so the model resolves "tomorrow" correctly
- Lists/reports group by `occurred_at` not `created_at`

### 5. AI parse → confirm before save

- Whenever an entry is created from AI-parsed text/voice, show a **confirmation sheet** before persisting
- Sheet content:
  - Echo of original input ("Bạn nói: …")
  - Parsed summary in user's language ("Tài chính · 500.000 ₫ · Ăn uống · hôm qua")
  - Buttons: **Save** · **Edit** (opens form pre-filled) · **Cancel**
- **Settings toggle:** `settingsStore.aiAutoConfirm` (default `true` = confirmation shown)
  - When `false`, save directly + show non-blocking toast with Undo (5s)
- Confirmation is the safety net; never skip without explicit user opt-out
- Voice input ALWAYS confirms regardless of setting (transcription errors are common)

### 6. Location (optional, GPS-default, clear-to-empty)

Every entry-creating module (Finance, Habits, Journals, Reminders, …) supports attaching a location.

- **Settings toggle:** `settingsStore.locationAccess` (default `false` — user opts in via Settings → Privacy → Location)
- **Per-entry behavior:**
  - When `locationAccess === true`: create-screen auto-populates location field with the **current GPS** position (label = reverse-geocoded address; lat/lng stored too)
  - User can **edit** the label or **clear** the field
  - If field is empty at save time → store `null` in `location_lat/lng/label` (don't write current position; respect user intent)
  - When `locationAccess === false`: field stays empty, user can manually fill via search/type (no GPS fetch)
- **Schema:** every entry table adds 3 nullable columns: `location_lat REAL`, `location_lng REAL`, `location_label TEXT`
- **Cross-platform:** `services/location.ts` wraps `expo-location` (native) + `navigator.geolocation` (web); handle permission denial gracefully (return null, don't crash)
- **Privacy:** location is PII — never log raw coords, never send to AI without anonymization (e.g. round to ~1km), respect Cross-Module Rule 1 wipe (clear all location data on module wipe)

### 7. CRUD completeness — every entry is editable

Every user-created entity (transaction, habit log, journal entry, reminder, …) MUST be:

- **Createable** via the create screen (or universal Add Activity)
- **Readable** as a detail / pre-filled edit form
- **Updateable** via the same create screen (re-used with `?id` param → pre-fill state → call `update` instead of `create`)
- **Deletable** with confirmation
  - Soft-delete from list (long-press or swipe) for low-friction undo
  - Hard-delete via Settings → "Delete all data" (Rule 1)
- **Primary tap action on a list row = open detail/edit** — never leave taps inert

Implementation pattern:
- Service: `getX(id)`, `createX(input)`, `updateX({ id, ...patch })`, `deleteX(id)` — all return `Result<T, AppError>`
- Single screen serves both create + edit (cuts code by ~50% vs separate screens)
- Header title switches between "New X" / "Edit X" via `useLocalSearchParams`
- Edit mode adds a Delete button in the footer

### 8. Error boundaries + observability — no white screens

- Every route in `app/` MUST be wrapped in an `<ErrorBoundary>` (top-level layout's `Stack` provides one; per-screen boundaries for risky areas like AI fetch)
- Boundary fallback: themed "Something went wrong" + retry + "report" button → opens prefilled bug report
- All caught errors flow to `services/logger.ts` → Sentry breadcrumb + capture
- **Required env:** `EXPO_PUBLIC_SENTRY_DSN` (client) + Sentry init in `app/_layout.tsx` before any provider mount
- **No silent failures:** every async service returning `Result.err` MUST surface to the user (toast, alert, or sheet) — never just log and continue
- Analytics events (`services/analytics.ts`, e.g. PostHog) follow the allow-list in `docs/ops.md` — never PII

## Roadmap

- **MVP** — auth, reminders, habits, journals, AI weekly reports
- **V1** — finance tracking, mood tracking, cloud sync
- **V2** — AI correlations, OCR receipts, voice input, smart notifications

## Detailed Docs (read when relevant)

| Topic | File |
|---|---|
| **Current sprint status, what's built, pending tasks** | **`docs/current-state.md`** ← read this first |
| System design, layers, data flow | `docs/architecture.md` |
| SQLite + Supabase schema, migrations | `docs/database.md` |
| API contracts, endpoints, conventions | `docs/api.md` |
| Finance domain: categories, rules, insights | `docs/finance-domain.md` |
| AI prompts, memory, finance AI features | `docs/ai-integration.md` |
| Sync engine, offline strategy, conflict resolution | `docs/sync-offline.md` |
| Auth, encryption, finance security | `docs/security.md` |
| Design tokens, UI/UX rules, components | `docs/design-system.md` |
| Deploy, env vars, testing, performance, monitoring | `docs/ops.md` |

## Glossary

- **Module** — feature domain (finance, habits, journals, reminders)
- **Insight** — AI-generated analysis of user data
- **Sync** — push local SQLite changes to Supabase cloud
