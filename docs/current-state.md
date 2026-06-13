# BataVasa Current State

> Single source of truth for project status. Last updated: 2026-06-13.

## Overall

| Tier | Status |
|---|---|
| Personal MVP | Done |
| Closed beta | Ready |
| Public launch | Blocked by verification, tests, and store submission work |

**Production score: 7/10.** Architecture, UX, sync, and business-logic coverage are strong enough for closed beta. Public launch should still wait until Google Auth is verified on a native build, CI stays clean, and fresh store screenshots are captured after the latest UI polish pass.

## What Is Built

### Core Platform

- Supabase Auth: email/password, login wall, account UI, session-aware store reloads.
- Google OAuth: implemented through Supabase OAuth and app callback handling; not yet manually tested.
- Offline-first SQLite: WAL, FK on, `PRAGMA user_version`, migration v12.
- Cloud sync engine: local `sync_queue`, queued writes for all 4 modules, AppState drain worker, per-module sync toggles, Supabase RLS SQL in `docs/supabase-setup.sql`.
- Biometric lock: `expo-local-authentication`, 30s AppState lock timer, Settings privacy toggle.
- Error boundary, analytics wrapper, PII-scrubbed logger, Sentry forwarding.
- i18n: 6 languages in `services/i18n/translations/`.
- Theme system: 5 themes with light/dark support.
- Onboarding: language, AI key, feature intro.
- Data management: export and wipe per module with double confirmation.

### Finance

- Transactions and categories CRUD, tap-to-edit, pagination.
- Category budgets and progress bars.
- Reports with weekly/monthly/quarterly/yearly/custom ranges and column charts.
- Date pickers for custom report ranges.
- Multi-currency display conversion via `services/fx.ts`.
- Display currency vs storage currency is now handled with minor-unit rules:
  - VND, JPY, KRW store whole units.
  - USD, EUR, GBP, CNY, THB, SGD and most others store minor units.
  - Reports/home/finance summaries convert to display currency when FX rates are available.
- Smart entry remains on the add/edit form. Quick entry was removed from the finance list screen.
- Finance review queue now has a dedicated filter on the transaction list.
- Finance transaction rows surface sign/category mismatches as review states instead of presenting an income category as a normal expense.
- Finance reports avoid labeling income categories as normal expense categories in category breakdowns.
- Merchant/category rules are stored in `finance_rule`, learned from manual/reviewed transactions, and applied to future smart/voice/OCR/import transactions.
- Recurring bill/subscription candidates are detected from repeated merchant/category/amount patterns and can prefill a monthly reminder.
- Monthly plan items settled this cycle show a green "paid" badge, sink below unpaid items, and drop out of the remaining planned totals (`getSettledPlanItemIds`).
- Debt book (sổ nợ, 2026-06-12): `finance_debt` table (migration v19) tracks lent/borrowed money per counterparty. Creating a debt records the money movement (lent = expense via the `Lending` system category, borrowed = income via `Borrowing`), optional due date creates a high-priority reminder that notifies `remind_days_before` days ahead. Settling records the opposite transaction and completes the reminder; deleting removes debt + linked transactions + reminder. Screens: `DebtListScreen` (`/debts`, entry card on the finance list) + shared create/edit `DebtFormScreen` (`/debt?id=`). Synced, exported, and wiped with the finance module.

### Reminders

- CRUD, recurrence, advance reminder minutes.
- Inbox items without a scheduled time.
- Today, Important, Inbox, and All filters on the reminder list.
- Priority-aware notification wording.
- Skip action advances recurring reminders to the next occurrence; one-off skips complete the reminder.
- Reminders with an advance window fire TWO notifications: one at `remind_at` (the early warning) and one at the event time itself (`scheduleNotificationsFor` in `features/reminders/services.ts`). Cancellation sweeps all notifications by reminder id, so both are cleaned up together. Applies to debts, bills, and any reminder with `advance_minutes > 0`.
- Completing, deleting, skipping, or changing scheduled reminder fields cancels stale scheduled notifications by reminder id.
- Local push notifications via `expo-notifications`.
- Smart add form with text/voice parse and preview-oriented layout.
- Reports use calendar date selection.

### Habits

- CRUD, daily log toggles, streak tracking.
- Custom schedules support selected weekdays. Weekly cadence still supports x-times-per-week via `target_per_period`.
- Streak milestones and row indicators.
- AI habit insight service.
- 7-day heatmap in reports.
- Skip/rest days are separated from completions in reports, shown in heatmap/history, and excluded from completion rate.
- Habit report export includes deleted habit definitions so historical skip logs can still display meaningful names. Missing historical names fall back to `deleted_habit`, not a UUID.
- Reports use calendar date selection.

### Journals

- CRUD with mood, date, and content.
- AI reflection service.
- Reports use calendar date selection.
- Smart add form with text/voice parse.
- Important entries are counted and listed in journal reports. Smart journal parsing can infer important events.
- Important entries can create a high-priority reminder one year after the event date.
- Journal templates: daily check-in, gratitude, stress log, money reflection, and habit reflection.

### Home And Cross-Module

- Daily Digest home with compact summary hero, unified Today Timeline read model, module cards, analysis entry, assistant entry, and safe-area-aware FAB.
- Universal Add Sheet opens from the `+` button only. The direct quick-entry box was removed from the home screen.
- Universal Add uses candidate-based parsing: AI can propose multiple module entries, the app validates them, and the user selects which candidates to save. Money + reflection can save as Finance + Journal after confirmation.
- Smart-entry missing-field policy (2026-06-13, all smart windows): incomplete parses are never silently dropped or errored. Each `UniversalCandidate` carries `missing: MissingField[]`; cards show an amber "Còn thiếu: …" line and saving prompts "Bổ sung / Lưu với mặc định". Defaults: missing reminder/habit title → the user's own text; missing habit target → 1×; missing date → today/tomorrow 09:00; missing debt counterparty → "Không xác định" (`t.unknown_person`); missing reminder date → offer to save as unscheduled inbox item. Finance smart entry with no recognizable amount prompts specifically for the amount instead of a generic AI error.
- Smart Entry lives inside add/edit forms for modules, not in list/dashboard screens.
- Voice input remains available in form/add flows and force-confirms before save where applicable.
- Voice microphone privacy prompt is shown only from voice buttons and can be dismissed permanently with "Do not show again".
- Assistant screen includes quick prompts for common personal-data questions.
- Journal list keeps only the primary create FAB floating; reflection and report actions live in the content action row.
- Report and AI output uses `components/InsightText.tsx` to render concise markdown as section cards instead of raw markdown text.
- Main-screen FABs and report footers use safe-area bottom spacing.
- Cross-module AI analysis (2026-06-12): `services/ai/crossModuleInsight.ts` now computes rule-based correlation blocks locally and asks the model only to explain them: per-habit kept-vs-missed comparison (mood, avg daily spend with "notable" flag at ≥15% delta, reminder completion rate, other-habit completion), spending by time-of-day and weekday, spending on journal-tagged activity days, and a reminders completion summary. AnalysisScreen feeds it habit logs (`listRecentLogs(30)` via new `listLogsSince` query) and reminders. Prompt requests 6 sections incl. habit impact, when/at-which-activities spending peaks, and recommendations for finance + mood; phrased as observations, not causation.

## Key Files

| Area | Files |
|---|---|
| App routes | `app/` |
| DB migrations | `database/core/migrate.ts` |
| DB queries | `database/<module>/queries.ts` |
| Stores | `store/*Store.ts` |
| Sync | `database/sync/queue.ts`, `services/sync.ts` |
| Auth | `store/authStore.ts`, `services/supabase.ts`, `services/identity.ts` |
| Settings | `store/settingsStore.ts` |
| AI | `services/ai/` |
| AI insight rendering | `components/InsightText.tsx` |
| FX conversion | `services/fx.ts`, `services/ai/aiLanguage.ts` |
| i18n | `services/i18n/translations/` |
| Store listing | `docs/store-listing.md` |
| Privacy policy | `docs/privacy-policy.md` |
| Supabase SQL | `docs/supabase-setup.sql` |
| B1/B2 verification | `docs/b1-b2-verification.md` |

## Current Blockers

### B1/B2 Verification

Code is implemented. Sync has been manually verified as working; Google Auth still needs manual verification before public launch:

- Run `docs/supabase-setup.sql` in the Supabase dashboard for the production project. (Re-run after 2026-06-12: adds the `finance_debt` table + RLS.)
- Follow `docs/b1-b2-verification.md` for the full command/manual checklist.
- Verified: create/update/delete/wipe sync from SQLite to Supabase is working.
- Verified: per-module sync toggles and offline queue drain are working.
- Still needs verification: Google Auth sign-in/callback/session restore on a real device or emulator.
- Still needs spot check before release: email/password sign up, sign in, sign out, session restore, and login wall on a real device or emulator.

### B5 Tests

Current test infrastructure is ready, but global coverage is still below the public-launch target.

- Latest automated run on 2026-06-13: `npm test -- --runInBand` passed; `npx tsc --noEmit` clean.
- Current status: 463 tests across 31 suites.
- Current coverage: 70.08% statements / 64.04% branches / 71.81% functions / 72.41% lines.
- Current CI floor: 37% statements / 35% branches / 31% functions / 39% lines.
- Target before public launch: keep statements/functions/lines above 70% and continue raising branch coverage toward 70%.
- Completed in this pass:
  - Habits DB query tests.
  - Journals DB query tests.
  - Universal Add candidate parser tests.
  - Reminder skip/notification cancellation service tests.
  - Sync queue and sync worker tests.
  - Settings store persistence tests.
  - Core migration tests.
  - AI insight builder tests for finance/habits/journals/cross-module.
- Next tests to add:
  - Continue raising coverage toward the 70% public-launch target.

### H18 Store Readiness

Repo-side assets and copy are mostly ready. Manual store work remains:

- Capture production screenshots on device/emulator.
- Capture fresh screenshots after the 2026-05-28 UI polish pass; do not use old screenshots with raw AI markdown, notification warnings, or crowded bottom actions.
- Finalize App Store Connect and Play Console metadata from `docs/store-listing.md`.
- Confirm support URL and privacy policy URL in `app.json`.
- Run a production build and smoke test before upload.

## Product Priorities

Work in this order:

1. **Closed beta verification**
   - Sync is verified working.
   - Verify Google Auth on device/emulator.
   - Spot check email/password Auth on device/emulator.
   - Run smoke test for all 4 modules.
2. **B5 coverage push**
   - Continue raising global coverage toward the 70% public-launch target.
   - Prioritize high-risk remaining gaps in stores, service error paths, reports, and UI workflows.
   - Keep `services/` and `database/` coverage as the hardening focus.
3. **H18 store readiness**
   - Capture production screenshots.
   - Finalize App Store / Play Console metadata.
   - Run production build smoke test.
4. **Small product improvements before broader beta**
   - **DONE:** Journal important flag: DB field, form toggle/star, list marker, dashboard count, report count/list, and AI parser hint.
   - **DONE:** Reminder priority/inbox: DB fields, form selector, list badge, Today/Important/Inbox filters, unscheduled inbox items, and priority-aware notifications.
   - **DONE:** Habit skip/rest day: DB field, skip action, non-streak-breaking skip logs, report count/history, and heatmap display.
   - **DONE:** Finance review queue: DB fields, review markers, dedicated filter, and merchant/category rule engine.
   - **DONE:** Journal important anniversary reminders: important entries can create a one-year follow-up reminder.
   - **DONE:** Journal templates.
   - **DONE MVP:** Habit custom schedule with selected weekdays.
   - **DONE MVP:** Finance recurring bills/subscriptions detection with reminder prefill.
   - **DONE MVP:** Reminder calendar view.
   - **DONE MVP:** Habit strength score.
   - **DONE MVP:** Journal tag/activity chips.
   - Remaining: continue hardening and visual QA before broader beta.
5. **UI polish follow-up**
   - **DONE:** AI/report markdown is rendered as section cards via `InsightText`.
   - **DONE:** Assistant quick prompts added.
   - **DONE:** Journal floating actions simplified.
   - **DONE:** Home/module hero density reduced and FAB safe-area spacing added.
   - **DONE:** Finance sign/category mismatch is surfaced as a review state.
   - Remaining: capture updated screenshots and do a visual QA pass on a real device.
6. **Differentiators after stability**
   - **M36 Cross-module behavioral patterns**: correlate Finance, Habits, and Journals, e.g. spending changes on low-mood days or habit completion patterns.
   - **M38 Global search**: one search across transactions, reminders, habits, and journals.
   - **M37 Proactive weekly insights**: background weekly summary notification via `expo-task-manager`.
7. **Later launch/business work**
   - **M21 Backup/restore**: user-facing recovery flow built on top of Auth and Sync.
   - **M19 Duplicate detection**: reduce false positives in finance.
   - **L4 Monetization/API key model** — **DECIDED: phased hybrid** (revisit before public launch, not a beta blocker).
     - **Closed beta:** keep current **BYO key** (multi-provider, free path via Groq/Gemini). Don't build billing before validating retention.
     - **Public launch:** **managed key as default** (frictionless for the mass-market target) **+ keep BYO as a power-user option** (zero cost for them, an escape hatch when quota is hit).
     - **Sell as subscription, not per-call.** Free tier = limited AI/month or BYO-only; Pro = "comfortable" AI with a fair-use cap behind the scenes. Per-call credit packs are harder to grok for a daily-use app.
     - **Managed mode prerequisites (all required):**
       1. **Never embed the key in the client** — RN bundles are extractable. Route through a **Supabase Edge Function proxy** that authenticates the user, meters usage, and enforces a hard quota.
       2. **Store IAP cut (15–30%)** — selling AI access in-app forces Apple/Google IAP (no in-app Stripe for digital goods); price above cost + cut.
       3. **Abuse control + aggressive prompt caching** so one user can't blow the budget; default to a cheap model (gpt-4o-mini / Haiku / Llama-via-Groq), escalate only when needed.
       4. **Privacy/GDPR** — managed mode routes user data through our server: update privacy policy, sign a DPA with the provider, and anonymize before sending (already required by CLAUDE.md). BYO mode keeps data device→provider direct.

## Noted Feature Ideas

Yes, add the proposed module features, but do it selectively. BataVasa should not copy full YNAB/Todoist/Day One/TickTick feature sets. The product should stay lightweight and use its advantage: Finance + Reminders + Habits + Journals + AI in one personal context.

### P0 - Do Before Broader Beta If Time Allows

These are small or medium scope and improve daily use without changing the product shape too much.

1. **Journal important flag - DONE**
   - Optional star/important marker for journal entries.
   - Use it to filter important life events, count important events in reports, prioritize Weekly Life Review, and give AI reflection stronger context.
   - Implemented: DB boolean, form toggle, list star, dashboard metric, report metric/list, and AI parser hint.

2. **Reminder priority - DONE**
   - Add low/medium/high priority.
   - Use it for Today/Overdue/Important views and notification wording.
   - Implemented: DB field, form selector, list badge, Today/Important/Inbox filters, unscheduled inbox items, and priority-aware notification wording.
   - Keep it flat; do not add Todoist-style projects yet.

3. **Habit skip/rest day - DONE**
   - Let users skip a day without breaking streak.
   - Important for realistic habit tracking and less punitive UX.
   - Implemented: DB field, skip action, skip logs excluded from streak/count, report skip count/history, and heatmap distinction.

4. **Finance transaction review queue - DONE**
   - Merchant/category rules and a review list for ambiguous smart entries.
   - Helps make finance data more reliable before advanced insights.
   - Implemented: `needs_review` and `review_reason` fields, AI/voice/OCR/import transactions marked for review, list marker, dedicated review filter, and merchant/category rules learned from reviewed/manual transactions.

### P1 - Next Product Layer

These make each module stronger and prepare cross-module insight work.

1. **Finance recurring bills/subscriptions - DONE MVP**
   - Detect repeated transactions and offer a reminder/bill calendar item.
   - Strong fit because Finance and Reminders already exist.

2. **Finance safe-to-spend - DONE MVP**
   - Show remaining spendable amount after budgets and recurring bills.
   - This gives a clearer daily answer than charts alone.
   - Implemented: `calculateSafeToSpend` (cycle-aware, fx-aware, plan items), shown on the finance overview.
   - Plan-match confirm (2026-06-12): a new expense that resembles a monthly plan item prompts the user to confirm ("is this your planned điện bill?"). Confirming links the transaction (`finance_transaction.plan_item_id`), settling the item for the cycle so the unspent remainder returns to safe-to-spend; declining is remembered (`plan_match_dismissed`) so the heuristic never silently re-matches. See `findMatchingPlanItem` / `maybeConfirmPlanItemMatch`.

3. **Reminder inbox - DONE**
   - Allow reminders without a scheduled time.
   - Add an "unscheduled" view to clean them up later.

4. **Reminder calendar view - DONE MVP**
   - Day/week/month view for reminders.
   - Reuse existing date picker/report patterns where possible.

5. **Habit custom schedule - DONE MVP**
   - Support daily, weekdays, selected days, and x times per week.
   - Required before habit insights become trustworthy.

6. **Habit strength score - DONE MVP**
   - Score stability over 30 days, not only current streak.
   - Better for AI summaries and Weekly Life Review.

7. **Journal templates - DONE**
   - Daily check-in, gratitude, stress log, spending reflection, habit reflection.
   - Helps users write more consistently.

8. **Journal tag/activity chips - DONE MVP**
   - Preset tags like work, family, health, money, sleep, exercise, stress.
   - Avoid complex free-form tagging until the UX is proven.

### Report Visual Improvements

Ordered priority list — make all module reports and the analysis screen both complete and polished.

1. **R1 — Stat delta badges — DONE**
   - All 4 report screens show vs-previous-period % change beside each key metric.
   - Green if improvement, red if decline. Hidden for custom date ranges and when previous period has no data.
   - Best streak (Habits) is excluded — streaks are continuous, not period-bound.

2. **R2 — Finance category donut — DONE**
   - Donut/pie chart of top 5 spending categories + "others" below the column chart.
   - Most common first question after seeing a total expense number.

3. **R3 — Habits 30-day calendar heatmap — DONE**
   - Replaced the 7-dot row per habit with a 5-week (35-day) calendar grid (7 cols × 5 rows).
   - Cell colors: habit color (done), muted border (skipped), subtle bg (empty), transparent (future).
   - Weekday labels (locale-aware narrow format) shown once above all habit grids.

4. **R4 — Reminders visual upgrade — DONE**
   - Replaced 3 plain stat cards with: DonutChart (completion rate, color-coded green/amber/red) + vs-previous delta badge.
   - Priority breakdown card (High/Medium/Low): colored bar + completed/total count + %.
   - Overdue list: up to 5 items with priority color dot, title, and date. Hidden when none.

5. **R5 — AnalysisScreen redesign — DONE**
   - Highlights card: last 30-day rule-based metrics — Finance expense, top spending category, best habit streak, Journal count + avg mood.
   - Comparison card: this month vs last month delta badges for Finance expense and Journal mood.
   - AI Patterns card: existing AI text wrapped in a labeled card with header icon instead of raw text dump.

### P2 - Differentiators After Stability

These are the features that make BataVasa meaningfully different from single-purpose apps.

1. **Weekly Life Review**
   - Flagship report across money, mood, habits, and reminders.
   - Should combine rule-based metrics with AI explanation.

2. **Cross-module behavioral patterns**
   - Examples: low mood vs spending spikes, habit completion vs journal mood, missed reminders vs stress logs.
   - Start rule-based; use AI for explanation, not raw calculation.

3. **Global search**
   - Search across transactions, reminders, habits, and journals.
   - Good "personal OS" feature once data volume grows.

4. **Proactive weekly insights**
   - Background weekly notification using `expo-task-manager`.
   - Should come after Weekly Life Review exists.

### Defer For Now

- Bank import / Plaid-style aggregation: high compliance, privacy, cost, and support burden.
- Investment/net-worth tracking: useful, but not core to BataVasa's current positioning.
- Credit score, bill negotiation, subscription cancellation: market-specific and partnership-heavy.
- Shared family/couple collaboration: wait until single-user sync is proven.
- Habit gamification/social challenges: likely to distract from the calm personal OS direction.
- Rich media journal/video/audio/OCR: storage and sync complexity is not worth it before public launch.

## Architecture Decisions

- SQLite is the source of truth for UI reads/writes.
- Supabase writes happen through the sync queue, not directly from UI.
- Conflict handling is last-write-wins using `updated_at`.
- Sync can be enabled/disabled per module in settings.
- Sync was manually verified working before the 2026-06-13 docs update.
- AI provider keys are stored in SecureStorage.
- Category names use canonical DB values and translate at display time.
- Locale-aware formatting must use `getDateFnsLocale(language)` and `getIntlLocale(language)`.
- Create and edit screens are shared via route params.
- Latest local migration is v19: `finance_debt` table + Lending/Borrowing system categories (system-category seeding is now idempotent by name, so older installs pick up new seed rows).
- `enqueue()` is try/catch wrapped for test compatibility.
- Cross-module timeline/life stream is a presentation/read-model layer over domain tables, not a unified `life_events` source-of-truth table.
- Reminders/notifications are treated as a capability attached to tasks/habits where appropriate; the current Reminders UI is task-oriented.

## Test Commands

```bash
npm test
npm run test:ci
npx tsc --noEmit
```

Use `npx tsc --noEmit` after code changes. Use `npm run test:ci` before release or when touching stores, services, DB queries, sync, or AI builders.

## Recent Changes To Remember

- 2026-06-13 follow-up pass (dual notifications, smart-entry missing fields):
  - Reminders now schedule a second notification at the event time when `advance_minutes > 0` (early warning + at-deadline ping). Covers debts, recurring bills, and manual reminders.
  - Smart entry across modules: missing fields prompt the user ("Bổ sung / Lưu với mặc định") instead of silent drops or validation errors. `universalEntry.ts` tracks `missing` per candidate; `aiParser.ts` (reminders) falls back title→input text and flags missing dates; missing reminder date can save to the unscheduled inbox; missing debt counterparty saves as "Không xác định"; finance smart entry without an amount asks for the amount specifically.
  - Fixed debt counterparty extractor leaving the verb "vay" as a person name for inputs like "cho vay 500k".
  - 16 new i18n keys ×6 languages (`smart_missing_*`, `field_*`, `unknown_person`, `reminder_save_inbox`).
  - Verification: `npx tsc --noEmit` clean; 463 tests across 31 suites pass.
- 2026-06-12 feature pass (safe-to-spend paid status, debt book, cross-module AI):
  - Monthly plan card badges items already settled this cycle as "paid" (green check, sunk to bottom, excluded from remaining planned totals) via exported `getSettledPlanItemIds`.
  - Debt book (sổ nợ): migration v19 `finance_debt`, debt services in `features/finance/services.ts` (create/update/settle/delete/restore + `summarizeDebts`), reminders integration for due dates, `DebtListScreen`/`DebtFormScreen` + `/debts`, `/debt` routes, entry card on the finance list, sync/wipe/export wiring, ~38 new i18n keys in all 6 languages (incl. `cat_lending`/`cat_borrowing` display translation).
  - Cross-module AI: habit kept-vs-missed impact block (mood/spend/reminders/other habits), spending timing (time-of-day, weekday), spending by journal activity tags, reminders summary; AnalysisScreen passes habit logs + reminders.
  - Verification: `npx tsc --noEmit` clean; 461 tests across 31 suites pass (`npm test -- --runInBand`).
- 2026-05-28 UI polish pass:
  - Added `components/InsightText.tsx` and applied it to Finance Insights, Finance Reports, and Cross-Module Analysis.
  - Updated AI prompts to request concise, non-judgmental markdown sections.
  - Suppressed Expo Notifications dev LogBox warnings so UI tests are not obscured.
  - Added Assistant quick prompts across all 6 languages.
  - Moved Journal reflection/report actions into an in-content row; only the create FAB floats.
  - Reduced Home/Finance/Habits/Reminders/Journals card density and made FABs safe-area-aware.
  - Finance transaction rows and finance category breakdown now surface sign/category mismatches as review states.
  - Habit report history no longer exposes UUIDs and can resolve deleted habit names from exported habit definitions.
  - Verification on 2026-05-28: `npx tsc --noEmit` passed; targeted tests passed with 57 tests across 6 suites.
- Removed quick entry from Home. Add now starts from the `+` button.
- Removed quick entry from Finance list. Add transaction now starts from `+`.
- Smart Entry remains inside module add/edit forms.
- Added FX minor-unit conversion and applied it to Home, Finance list, and Finance reports.
- Updated AI amount rules so JPY/KRW use whole units instead of `amount * 100`.
- Updated FX, AI language, and logger tests after the currency-rule change.
- Added Habits and Journals DB query tests; CI now passes with 202 tests across 22 suites.
- Implemented P0 minimum viable slice: journal important flag, reminder priority, habit skip/rest day, and finance review markers.
- Completed the remaining P0 product layer: journal important report/parser hint, finance review filter/rule engine, and richer habit skip report/history.
- Added pre-closed-beta product polish: reminder inbox/filters/priority notifications, journal templates, habit selected-day schedules, and recurring finance reminder suggestions.
- Added one-year high-priority reminders for important journal entries.
- Added Universal Add multi-candidate confirmation so ambiguous or multi-intent text is not silently forced into one module.
- Added reminder skip/reschedule behavior and stale notification cancellation by reminder id.
- Added "Do not show again" persistence for the pre-microphone privacy prompt.
- Added sync queue/worker and settings query/store persistence tests.
- Added core migration coverage for fresh installs, version resume, idempotent additive columns, and in-flight reuse.
- Added AI insight builder coverage for finance, habits, journals, and cross-module prompts/parsing.
- Added new-user onboarding/UX polish: global success toast (`store/toastStore.ts` + `components/Toast.tsx`, mounted in `app/_layout.tsx`), "Saved · syncs when online" feedback on all create/update flows + sign-in, a Help/Quick-Tips screen (`app/help.tsx`, linked from Settings and a home header `?` button), a shared "Create → Save offline → Auto-sync" `components/FlowDiagram.tsx` used in onboarding + Help, auth-screen benefit messaging + tagline, quick "create directly" module chips in the Universal Add sheet, and friendlier non-technical wording (removed "backend"/"Supabase" from the auth-not-configured message). Added 33 i18n keys across all 6 languages.
