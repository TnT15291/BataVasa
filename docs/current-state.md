# BataVasa — Current State
> Quick-load context for Claude. Read this instead of scanning the codebase cold.
> Last updated: 2026-05-22.

---

## Overall Status

| Tier | Status |
|---|---|
| MVP cá nhân | ✅ Done |
| Beta closed | ✅ Done (B1 Auth + B2 Sync live) |
| Public launch | ❌ Blocked on B5 Tests (37% → 70% coverage) + H18 screenshots |

**Production score: 6/10.** Architecture and UX strong; test coverage is the gating factor.

---

## What's Built (Sprint 1–3 + post-sprint)

### Auth & Sync
- **B1 Auth** ✅ — Supabase email/password, login wall in `app/_layout.tsx`, `store/authStore.ts`, `features/auth/AuthScreen.tsx`, `services/identity.ts`. i18n 6 langs.
- **B2 Cloud Sync** ✅ — `database/sync/schema.ts` + `database/sync/queue.ts` + `services/sync.ts`. Offline-first: every write enqueues → drain worker on AppState foreground. All 4 modules wired. Supabase RLS SQL in `docs/supabase-setup.sql`.
- **Biometric lock** ✅ — `services/biometric.ts`, `components/BiometricLockScreen.tsx`, `settingsStore.biometricLock`, 30s AppState timer, Settings → Privacy toggle.

### Finance module
- Full CRUD (transactions + categories) with `Result<T,AppError>` pattern
- AI smart entry (`services/ai/smartEntry.ts`), voice input, confirm sheet
- Reports 4-tab (Weekly/Monthly/Yearly/Custom) with period navigation
- Category budgets + progress bar
- Multi-currency display via `services/fx.ts`
- Pagination (PAGE_SIZE=50)

### Habits module
- Full CRUD: habits + habit_log tables
- Toggle today's log (tap row in HabitListScreen)
- **Streak tracking**: `getHabitStreak()` in `features/habits/services.ts`; `streak` hydrated per-habit in store
- **Flame icon** on rows with active streak; **milestone Alert** at 3/7/14/30/60/100 days
- **AI Insight**: `services/ai/habitInsight.ts` → consistency summary, strongest, needs attention, encouragement, tip
- **7-day dot heatmap** per habit in HabitsReportScreen
- Reports 4-tab

### Journals module
- Full CRUD with mood (1–5), occurred_at, content
- AI reflection (`services/ai/journalInsight.ts`): mood_summary, themes, recurring_questions, gentle_prompt
- Reports 4-tab

### Reminders module
- Full CRUD, recurrence (daily/weekdays/weekly), advance_minutes
- Local push notifications via `expo-notifications` + `services/notifications.ts`
- AI smart parse (`services/ai/reminderParser.ts`)

### Cross-module
- **Universal Add Sheet** — text + voice → intent classifier → routes to module
- **Smart Entry on form screens** — all 4 module form screens have NL text + voice → AI parse → pre-fill
- Voice input across 6 screens, always force-confirms before save
- **Onboarding modal** 3-step: language → AI key → features (`features/home/components/OnboardingModal.tsx`)
- **Data Management screen**: export/wipe per module, double-confirm
- i18n 6 languages (en/vi/ja/ko/fr/zh), all keys in `services/i18n/translations/`
- 5 themes × light/dark, `services/locale.ts` for date-fns + Intl locale
- Analytics allow-list wrapper (`services/analytics.ts`)
- ErrorBoundary (class) wraps Stack + Sentry
- Logger PII scrub + Sentry forwarding

---

## Key File Locations

| What | Where |
|---|---|
| DB migrations | `database/core/migrate.ts` (v8, WAL, sync_queue) |
| SQLite queries | `database/<module>/queries.ts` |
| Business logic | `features/<module>/services.ts` |
| Zustand stores | `store/<module>Store.ts` |
| AI services | `services/ai/` (financeInsight, habitInsight, journalInsight, smartEntry, habitParser, journalParser, reminderParser, universalEntry, reports, crossModuleInsight) |
| i18n translations | `services/i18n/translations/{en,vi,ja,ko,fr,zh}.ts` — vi.ts is the source of truth type |
| Sync engine | `database/sync/queue.ts` + `services/sync.ts` |
| Auth store | `store/authStore.ts` |
| Settings store | `store/settingsStore.ts` (language, theme, aiProvider, biometricLock, locationAccess, aiAutoConfirm, per-module sync toggles) |
| App routes | `app/` — Expo Router file-based routing |

---

## Pending Tasks (by priority)

### 🔴 BLOCKER
- **B5 Tests** — needs habits/journals DB query tests + sync/settings/core DB tests + AI insight tests → hit 70% global coverage (currently 37% statements, 184 tests/19 suites)

### ⚠️ HIGH
- **H18 App Store assets** — copy done (`docs/store-listing.md`), privacy policy done. **Manual remaining**: capture screenshots on device/emulator, build with EAS, upload to App Store Connect + Play Console.

### 🟡 MEDIUM
- **M36** Cross-module behavioral patterns (Finance × Habits × Journals correlations) — biggest USP not yet built
- **M37** Proactive weekly push insights via expo-task-manager
- **M38** Global search ("cà phê" → all matching entries across modules)
- **M21** Backup/restore (requires B1+B2 ✅)
- **M29** FX conversion display currency (single-currency summary view)

---

## Architecture Decisions (non-obvious)

- **Offline-first always**: every write → SQLite first → async sync queue. Never write to Supabase directly from UI.
- **LWW conflict resolution**: last-write-wins via `updated_at` timestamp. No merge logic.
- **Sync toggle per module**: `settingsStore.syncHabits/syncJournals/etc` — worker checks before draining.
- **AI keys stored in SecureStorage** via `services/secureStorage.ts`, never in AsyncStorage or SQLite.
- **Category translation at display time**: DB stores canonical English name; `translateCategoryName()` in `features/finance/i18n.ts` translates for display. Never translate user-created rows.
- **Locale-aware**: all date/number formatters use `getDateFnsLocale(language)` / `getIntlLocale(language)` — never hardcode `'vi-VN'` or `'en-US'`.
- **Single screen for create + edit**: `useLocalSearchParams` checks for `?id` param → edit mode; same form, header title switches.
- **Migration system**: `PRAGMA user_version` in `database/core/migrate.ts`, currently v8. Add v9 for next schema change.
- **enqueue() is try/catch wrapped** in sync/queue.ts for test compatibility (Jest doesn't have SQLite).

---

## Test Infrastructure

```
npm test           # watch
npm run test:ci    # coverage gate (thresholds in jest.config.js)
```

- Per-file 90% lock on pure helpers
- Global floor: 37% statements / 35% branches / 31% functions / 39% lines (ratchet up as you add tests)
- Sentry import is lazy (`jest.mock`) to avoid init errors in tests
