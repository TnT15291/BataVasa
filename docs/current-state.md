# BataVasa Current State

> Single source of truth for project status. Last updated: 2026-07-18.
>
> Latest full repository audit: `docs/repo-audit-2026-07-18.md`.

## Overall

| Tier | Status |
|---|---|
| Personal MVP | Done |
| Closed beta | Keep open until the beta-close scope below is finished |
| Public launch | Blocked by beta-close scope, verification, tests, and store submission work |

**Production score: 6.5/10.** Architecture, UX, sync, and business logic are strong enough for closed beta usage. Managed-AI abuse controls and account-state isolation are now implemented, but public launch remains blocked by deploying/verifying those controls, native verification, coverage, restore UX, and store submission work.

## What Is Built

### Core Platform

- Supabase Auth: email/password, login wall, account UI, session-aware store reloads.
- Google Auth: native Google Sign-In path for dev/native builds when Google client env is present, plus OAuth browser fallback. Callback/deep-link handling is hardened but still needs manual device verification.
- Offline-first SQLite: WAL, FK on, `PRAGMA user_version`, migration v23.
- Cloud sync engine: local `sync_queue`, queued writes for the core modules plus Goals, AppState drain worker, per-module sync toggles, Supabase RLS SQL in `docs/supabase-setup.sql`.
- Biometric lock: `expo-local-authentication`, 30s AppState lock timer, Settings privacy toggle.
- Error boundary, analytics wrapper, PII-scrubbed logger, Sentry forwarding.
- i18n: 6 languages in `services/i18n/translations/`.
- Theme system: 5 themes with light/dark support.
- Onboarding: language, feature intro (2 steps). AI is fully backend-managed (provider + key set by the publisher via Supabase secrets), so there is no AI-key/provider onboarding step.
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
- Monthly plan items can be repeating monthly or one-time for the current month. Items settled this cycle show a green "paid" badge, sink below unpaid items, and drop out of the remaining planned totals (`getSettledPlanItemIds`).
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
- Atomic Habits selective enhancements: "never miss twice" nudge appears when a scheduled habit was missed yesterday and is still open today; optional identity field is stored on habits and surfaced as completion encouragement.

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
- Smart-entry missing-field policy (2026-06-13, all smart windows): incomplete parses are never silently dropped or errored. Each `UniversalCandidate` carries `missing: MissingField[]`; cards show an amber "Còn thiếu: …" line and saving prompts "Bổ sung / Lưu với mặc định". Defaults: missing reminder/habit title → the user's own text; missing habit target → 1×; missing date → today/tomorrow 09:00; missing reminder date → offer to save as unscheduled inbox item. Finance smart entry with no recognizable amount prompts specifically for the amount instead of a generic AI error.
- Universal Add no longer parses finance plan or debt-book candidates from the home/global entry point; those stay in the Finance module's local flows.
- Smart Entry lives inside add/edit forms for modules, not in list/dashboard screens.
- Voice input remains available in form/add flows and force-confirms before save where applicable.
- Voice microphone privacy prompt is shown only from voice buttons and can be dismissed permanently with "Do not show again".
- Assistant screen includes quick prompts and a deterministic module-data context builder so it can answer questions from Finance, Tasks, Habits, Journals, and Goals using existing user data.
- Journal list keeps only the primary create FAB floating; reflection and report actions live in the content action row.
- Report and AI output uses `components/InsightText.tsx` to render concise markdown as section cards instead of raw markdown text.
- Main-screen FABs and report footers use safe-area bottom spacing.
- Global Search MVP (2026-06-19): `services/search.ts` searches Finance transactions, Tasks, Habits, Journals, and Goals with grouped results in `SearchScreen` (`/search`). Home search now opens Global Search; Modules includes Search.
- Goals MVP (2026-06-19): `goal` table (migration v21), `database/goals/queries.ts`, `features/goals/services.ts`, `store/goalsStore.ts`, and screens `/goals`, `/goal`, `/goal-detail`. MVP supports manual goal creation with derived progress from Finance category totals and Habit completion rate. Goals are synced (`goal` table), exportable/wipeable, and included in Supabase RLS SQL.
- Weekly Life Review MVP (2026-06-19): `/weekly-review` provides a connected weekly snapshot across Goals, Finance, Habits, Journals, and Tasks. `services/ai/weeklyLifeReview.ts` computes deterministic metrics first, then AI generates the narrative review from those metrics. Home Reports quick action opens Weekly Review.
- Cross-module AI analysis (2026-06-12): `services/ai/crossModuleInsight.ts` now computes rule-based correlation blocks locally and asks the model only to explain them: per-habit kept-vs-missed comparison (mood, avg daily spend with "notable" flag at ≥15% delta, reminder completion rate, other-habit completion), spending by time-of-day and weekday, spending on journal-tagged activity days, and a reminders completion summary. AnalysisScreen feeds it habit logs (`listRecentLogs(30)` via new `listLogsSince` query) and reminders. Prompt requests 6 sections incl. habit impact, when/at-which-activities spending peaks, and recommendations for finance + mood; phrased as observations, not causation.

## Key Files

| Area | Files |
|---|---|
| App routes | `app/` |
| DB migrations | `database/core/migrate.ts` |
| DB queries | `database/<module>/queries.ts` |
| Stores | `store/*Store.ts` |
| Sync | `database/sync/queue.ts`, `services/sync.ts` |
| Auth | `store/authStore.ts`, `services/supabase.ts`, `services/identity.ts`, `services/authDeepLinks.ts` |
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

Code is implemented. Sync has been manually verified as working; Google Auth and password recovery still need manual verification before public launch:

- Run `docs/supabase-setup.sql` in the Supabase dashboard for the production project. (Re-run after 2026-06-12: adds the `finance_debt` table + RLS.)
- Follow `docs/b1-b2-verification.md` for the full command/manual checklist.
- Verified: create/update/delete/wipe sync from SQLite to Supabase is working.
- Verified: per-module sync toggles and offline queue drain are working.
- Still needs verification: Google Auth sign-in/callback/session restore on a real device or emulator.
- Still needs verification: password reset email -> `batavasa://reset-password` deep link -> set new password -> app session.
- Still needs spot check before release: email/password sign up, sign in, sign out, session restore, and login wall on a real device or emulator.

### B5 Tests

Current test infrastructure is ready, but global coverage is still below the public-launch target.

- Latest automated run on 2026-06-20: `npm test -- --runInBand` passed; `npx tsc --noEmit` clean.
- Current status (2026-07-18): 635 tests across 53 suites; all passing.
- Current coverage: 67.31% statements / 58.96% branches / 73.57% functions / 69.16% lines.
- Managed-AI hardening now includes authenticated persistent hourly quotas, prompt/message/token limits, and audio request limits. Deployment requires reapplying `docs/supabase-setup.sql` and redeploying `ai-chat` plus `ai-transcribe`.
- Auth transitions now reload and clear Goals and AI Context in addition to the original four modules; regression coverage protects account-state isolation.
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
  - Auth deep-link redirect/parser tests.
  - App-guide preset/fallback tests.
  - Weekly teaser and long-term assistant context tests.
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

1. **Stabilize and commit the current pass**
   - Review the managed-AI, UI, sync/schema, Supabase function, and docs changes currently in the worktree.
   - Run `npx tsc --noEmit` and `npm test -- --runInBand`.
   - Commit the current coherent batch before starting the beta-close feature sequence.
2. **Beta-close feature sequence**
   - **DONE MVP:** M38 Global search: one search across transactions, reminders, habits, journals, and goals.
   - **DONE MVP:** Goals MVP: manual goal creation + derived progress for finance category totals and habit completion rate.
   - **DONE MVP:** Weekly Life Review: flagship cross-module weekly report using deterministic metrics plus AI explanation.
   - **DONE MVP:** Context memory layer: user goals/preferences/facts available to AI prompts and review summaries.
   - **DONE MVP:** M37 Proactive weekly insights: opt-in weekly local notification → deep-links to Weekly Life Review.
   - **DONE MVP:** Habit selective enhancements: "never miss twice" nudge plus optional identity field.
   - **DONE MVP:** M21 Backup/restore file UI: one-file manual backup export from Settings → Data Management. Restore/import wizard remains a follow-up before public launch.
3. **Beta-close verification**
   - Sync is verified working.
   - Verify Google Auth on device/emulator.
   - Verify password recovery on device/emulator.
   - Spot check email/password Auth on device/emulator.
   - Run smoke test for all 4 modules.
   - Run a full smoke test of Global Search, Goals, Weekly Life Review, memory-aware AI, proactive notifications, and backup export.
4. **B5 coverage push**
   - Continue raising global coverage toward the 70% beta-close/public-launch target.
   - Prioritize high-risk remaining gaps in stores, service error paths, reports, and UI workflows.
   - Keep `services/` and `database/` coverage as the hardening focus.
5. **H18 store readiness**
   - Capture production screenshots.
   - Finalize App Store / Play Console metadata.
   - Run production build smoke test.
6. **Small product improvements already completed**
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
   - **DONE MVP:** Habit selective enhancements: "never miss twice" nudge and optional identity field.
   - **DONE MVP:** Journal tag/activity chips.
   - Remaining: continue hardening and visual QA before beta close.
7. **UI polish follow-up**
   - **DONE:** AI/report markdown is rendered as section cards via `InsightText`.
   - **DONE:** Assistant quick prompts added.
   - **DONE:** Journal floating actions simplified.
   - **DONE:** Home/module hero density reduced and FAB safe-area spacing added.
   - **DONE:** Finance sign/category mismatch is surfaced as a review state.
   - Remaining: capture updated screenshots and do a visual QA pass on a real device.
8. **Later launch/business work**
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

### P2 - Beta-Close Differentiators

These are now part of the beta-close scope. Finish these before declaring closed beta complete.

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
- Sleep/nutrition/fitness as separate trackers: better as attributes in Habits/Journals, not standalone modules.
- Calendar/email/bank integrations: high dependency risk and engineering complexity.
- Social/sharing/gamification: diverges from "calm personal OS" positioning.

## Long-Term Product Vision: From Tracker to Life Assistant

> **Strategic direction before beta close.** BataVasa is currently a "personal OS" (~90% coverage) but only a "life assistant" (~50%). The gaps are not missing modules, but missing **intelligence layers**: proactivity, cross-module understanding, and goal-oriented memory. These gaps should be closed before ending closed beta.

**TL;DR:** 4 modules (Finance, Reminders, Habits, Journals) are feature-complete for MVP. To move from "tracker" to "assistant," the roadmap adds **3 intelligence layers + 1 unifying Goals module**, not new domains.

### Why Not A Full Assistant Yet

| Dimension | Current | Status | Target |
|---|---|---|---|
| **Multi-domain capture** (4 modules) | ✅ Finance, Reminders, Habits, Journals + CRUD + sync | ✅ Done | ✅ Achieved |
| **Per-module analysis** (AI insights) | ✅ Module-specific insights | ✅ Done | ✅ Achieved |
| **Proactivity** (auto-reminders/alerts) | ❌ Pull-only, M37 not started | ❌ Missing | Checklists, mood dips, budget overages → calm notifications |
| **Cross-module understanding** (correlations) | 🟡 Highlights + comparison (M36 started) | 🟡 Partial | Spending ↔ mood ↔ habits; recommendations from patterns |
| **Goal/context memory** (who you are, what you're trying to do) | ❌ Stateless AI, no goal framework | ❌ Missing | Goals module + user context store for AI |
| **Action loop** (insight → suggestion → 1-tap accept) | ❌ Insights only, no follow-up | ❌ Missing | Weekly Review suggestions → quick actions |

**Verdict:** Full backbone (data from 4 mods) exists. **Brain** (memory, proactivity, connections) is mostly missing. Roadmap below fixes that without adding more domains.

### LAYER 1 — Trust Foundations (Hygiene, Not Differentiator)

These are table-stakes for "personal OS" — dull but critical.

#### 1a. Global Search (M38)

- **Problem:** Users write daily but rarely retrieve → data becomes "write-only archive."
- **Solution:** Unified search across all 4 modules (transactions, reminders, habits, journal entries) filtered by text, date range, amount, or tags.
- **Implementation:** `services/search.ts` queries all domain tables in parallel; optional AI layer translates natural language questions into deterministic filters (amount/date arithmetic remains rule-based per CLAUDE.md Rule 2).
- **Scope:** low risk (read-only), medium value (high engagement). Recommended: **do first in the beta-close sequence.**
- **UX:** `app/search.tsx` with debounce, results grouped by module; can start minimal (exact-match string search) and add AI later.

#### 1b. Backup / Restore (M21)

- **Problem:** Users only trust apps that survive device loss. "Sync to cloud" is implementation, but users think "backup."
- **Current state:** 80% done — sync queue + Supabase remote + per-module `exportAllData()` exist. Missing:
  - **Cloud restore:** new device → login → pull from Supabase (sync infra exists; needs UX clarity + B1/B2 verification).
  - **Manual file backup:** Settings → Data Management now exports one versioned JSON backup containing Finance, Habits, Journals, Reminders, Goals, and AI memory.
  - **Restore follow-up:** import wizard still needs versioning, deduplication, and conflict-resolution UX before public launch.
- **Implementation:** `services/backup.ts` orchestrates module exports; Settings → Data Management → Backup/Restore.
- **Scope:** export MVP is low-medium risk and implemented; restore remains medium-high risk.

### LAYER 2 — The Brain (Insight → Action)

These are the "assistant" features that make the app *know* your context and *help* you act.

#### 2a. Weekly Life Review (Flagship)

- **What:** Unified weekly narrative across all 4 modules + goals, replacing 4 separate reports.
- **Example:** *"Week of May 26: You spent 2.1M (−12% vs prev). Completed 5/7 habits. Journaled 3×, avg mood was calm. Overdue: 1 reminder. Insight: low mood on Wed correlated with 400k spending spike — journaling on those days might help. Next week: focus on [goal] and try [habit]."*
- **Implementation:** Deterministic aggregation (same as Reports), AI explains + suggests (never arithmetic). Timestamp-aware prompt so AI resolves relative dates correctly.
- **Scope:** medium (design, prompt tuning, scheduling).
- **Timing:** ship after Goals module exists (so Review can reference goals).

#### 2b. Goal/Context Memory Layer — DONE MVP (2026-06-20)

- Implemented: `user_context` table (migration v23) holding short user-authored memories typed as `goal` / `preference` / `fact`. `database/context/{schema,queries}.ts`, `features/context/{types,services}.ts` (Result-based CRUD + export/wipe), `store/contextStore.ts`.
- `services/ai/userContextPrompt.ts` keeps a DB-decoupled cache (fed by the store) and exposes `withUserContext(systemPrompt)`, injected into every generative AI surface: assistant chat, weekly life review, cross-module analysis, finance/habit/journal/reminder insights, finance reports, and the goal coach. Deterministic parsers (smart/universal entry) are intentionally NOT injected.
- Management UI: `AIMemoryScreen` (`/ai-memory`, linked from AI settings) — add/edit/delete memories, plus per-Rule-1 sync toggle (`syncContext`), JSON export, and wipe. Synced (`user_context` in `services/sync.ts` + Supabase RLS), exported, and wiped.
- 16 i18n keys × 6 languages. Cache warmed at app start in `app/_layout.tsx`.

- **Problem (original):** AI is stateless — each prompt rebuilds from recent data, missing long-term context.
- **Solution:** Store user-provided facts + inferred insights (goals, preferences, patterns) → inject into every AI system prompt.
  - **Explicit:** "I want to save 50M this year. Budget for dining is 2M/month."
  - **Inferred:** "You typically spend more on weekends" or "You tend to journal when stressed."
- **Implementation:** Table `user_context` (text field for goals + facts) + baked into system prompts via a helper. Follows Cross-Module Rule 1 (wipe/export/sync).
- **Example:** Without memory: *"You spent a lot on food."* With memory: *"You spent 3M on food — that's 1.5× your usual 2M weekly budget, and above your goal of dining < 2M/month."*
- **Scope:** small-medium; is a prerequisite for Weekly Review to be truly personalized.

#### 2c. Proactive (Background Summaries) — DONE MVP (2026-06-20)

- Implemented as an **opt-in scheduled local notification** (not a background task — far more reliable, works without `expo-task-manager`, and stays calm). `services/proactiveSchedule.ts` (pure, tested) computes a weekly trigger; `services/proactiveNotifications.ts` schedules/cancels/reconciles a single weekly `expo-notifications` WEEKLY trigger tagged `weekly_review`.
- Settings (default OFF): `proactiveWeeklyReview` + `proactiveWeeklyDay` (expo weekday 1-7) + `proactiveWeeklyHour`. UI in `SettingsScreen` (toggle + locale-aware weekday chips + hour stepper). `syncWeeklyReviewNotification()` runs at app start and on every change.
- Tapping the notification deep-links to `/weekly-review` via `features/notifications/useNotificationRouting.ts` (`useLastNotificationResponse`, handles cold start). 7 i18n keys × 6 languages.
- **Smart teaser (2026-06-20):** `services/weeklyTeaser.ts` computes a deterministic one-glance week summary from SQLite (expense + % vs last week, habit completions, avg mood, overdue tasks) and stamps it onto the scheduled notification body (icon+number, language-proof; falls back to the static localized body when there's no data). Re-stamped on app start and on every foreground (`_layout` AppState `active`) so it reflects the latest session. Pure `formatWeeklyTeaser` is unit-tested.
- Future enhancement (deferred): a true *background*-computed teaser via `expo-task-manager` (would refresh even if the app is never opened). The foreground-stamped teaser covers the value without the reliability/native cost.

- **Problem (original):** User has to open the app to read Weekly Review or learn about anomalies.
- **Solution:** `expo-task-manager` runs weekly (e.g., Sunday 9 AM) → calculates summary → `expo-notifications` → deep-link to relevant screen.
- **Scope:** low-medium implementation; medium polish (ensure notifications are not annoying).
- **Timing:** late (do after Weekly Review exists and is solid).
- **Design principle:** "Calm" = opt-in, daily frequency ceiling, allow-list of events (anomalies, milestones, reviews only).

### The Goals Module — The Unifying Spine

**Why 5th module?** Not a new tracker, but a *projection layer* that **connects goals to drifts in Finance, Habits, Reminders, Journals**. Adds long-term intent, keeps app focused, feeds AI memory and Weekly Review.

#### Vision

A goal = an intention with a measurable, time-bounded target that auto-derives progress from existing modules.

| Goal Example | Auto-Source | Calculation |
|---|---|---|
| "Save 50M in 2026" | Finance category `Savings` | SUM(amount) WHERE category.kind='savings' AND year(occurred_at)=2026 |
| "Gym 4×/week" | Habit `Gym` | completion_rate(last 30 days) vs target |
| "Journal daily" | Journals module | COUNT(entries) / days_elapsed |
| "Reduce dining to <2M/month" | Finance category `Dining` | SUM(amount) WHERE category='Dining' AND month(occurred_at)=current |
| "Stress level down" | Journals mood tag | manual check-in weekly, or derive from mood field if collected |

**Key principle:** Progress is **derived**, not manually entered. App calculates like it does for Reports → low friction + always current.

#### Data Model

- `goals` table: `id, user_id, title, description, target_type (amount, rate, count, mood), target_value, unit, start_date, due_date, metric_binding (JSON: which module + how to extract), status`
- Metric binding = the query logic, e.g. `{ "module": "finance", "category_id": "X", "aggregation": "sum_amount" }`
- Progress is a **derived view**, recalculated on-demand or cached + invalidated on module writes.

#### UX

- **List:** cards with circular progress, title, metric (e.g. "4.2M / 50M saved"), due date.
- **Detail:** full progress bar, monthly/weekly breakdown, linked entries (e.g. "Dining transactions this month"), AI-generated nudge (e.g. "You're on track; keep it up").
- **Create:** choose goal type → app suggests metric binding → user picks dates + target value. Minimal form.
- **Universal Add:** can create goals via text (e.g. "save 50M by dec") → AI parse + confirm per Rule 5.

#### Cross-Module Benefits

1. **Weekly Life Review has a spine:** "On track for 3 of 4 goals; focus on X."
2. **AI gets context:** *"Current goal: save 50M (at 8M, 16% done). Latest insight: dining budgets are busting month-end. Suggestion: front-load dining budget to early month."*
3. **Reminders know intent:** Habit reminder can mention goal progress (e.g. *"3/4 gym sessions done this week; one more to hit your goal"*).
4. **Proactive notifications:** Milestone reached (e.g. 50% saved), goal at-risk (overspending), or streak broken.

#### Cross-Module Rules Compliance

Must implement all 8 mandatory rules (Rule 1: sync/export/wipe; Rule 2: i18n + locale format; Rule 3: universal add; Rule 4: backdated entries; Rule 5: AI parse → confirm; Rule 6: location; Rule 7: CRUD; Rule 8: error boundary + logger).

**Feature folder structure:**
```
features/goals/
  screens/GoalsListScreen.tsx
  screens/GoalsDetailScreen.tsx
  screens/GoalsFormScreen.tsx
store/goalsStore.ts
database/goals/queries.ts
database/goals/schema.ts
ai/goalInsight.ts
services/goalProgress.ts  ← derive progress from modules
```

#### Phased Rollout (To Avoid Scope Creep)

- **Phase 1 (MVP):** Manual goal creation + progress derivation for 2–3 goal types (savings + habit tracking). No universal add yet. Context memory layer (optional).
- **Phase 2:** Universal add goal parsing, goal-based reminders/notifications, Weekly Review integration.
- **Constraint:** keep `metric_binding` types small; add new types only after validating demand.

### Habits Module — Atomic Habits Framework (Selective)

BataVasa's habits module should **embody the 4 Laws** rather than re-implement every Atomic Habits concept as a feature.

#### Already Implemented

- ✅ **Clarity** — habit name, goal/target, schedule, notification times.
- ✅ **Attractiveness** — streak, heatmap, completion badges (done).
- ✅ **Ease** — notification times (v13, fully integrated), skip/rest day (no streak penalty), recurring vs one-time reminder (flexible).
- ✅ **Satisfaction** — streak milestones, heatmap visual feedback, "never miss twice" opportunity.

#### Selective Additions (Beta-Close)

| ✅ Do (High Leverage) | 🟡 Conditional | ❌ Skip (Not a Feature) |
|---|---|---|
| **DONE MVP: "Never miss twice"** — gentle nudge when yesterday was missed and today is still open | **Habit stacking** ("After [cue habit] → do [new habit]") — only if user explicitly links | "2-minute rule" → coaching tip, not a feature |
| **DONE MVP: Identity-based framing** — optional text field surfaced as completion encouragement | **Numeric habits** (reps, duration) — v2+, opt-in, mutable | "Environment design" → user responsibility, not gamified |
| **Implementation intention** — auto-compose from habit name + notification time + optional location → clear "When & Where" statement | **Habit scorecard** → just a journal template | "Temptation bundling" → user choice, not coded |

#### 3 Priorities (If Time Allows Before Beta Closes)

1. **DONE MVP: "Never miss twice"** — gentle row nudge; no automatic rescheduling yet.
2. **DONE MVP: Identity field** — optional text input stored on the habit and used for completion encouragement.
3. **Implementation intention statement** — auto-generate from habit + time + location (data already exists) → display as a reminder preview or in weekly review.

#### Guardrails

- **Never gamify heavily** (BataVasa is "calm").
- **All habit features are opt-in** — defaults are minimal; user chooses complexity.
- **Ship 1–2 in the beta-close sequence**, not a whole feature dump. Observe user response before adding more.
- **Measurement is motivating only if voluntary** — remove any pressure.

### What NOT To Build (Philosophy)

- ❌ **Fitness/sleep/nutrition as separate trackers** — clutters the app. Habits already cover these; add preset templates instead (e.g. "Sleep 8hrs" habit).
- ❌ **Full calendar/email/bank integrations** — high platform dependency. Better as future add-ons (post-public-launch).
- ❌ **Collaboration/family sharing** — diverges from "personal OS" mission.
- ❌ **Aggressive gamification (badges, leaderboards, streaks as currency)** — conflicts with "calm."
- ❌ **Rich media (audio/video/OCR)** — storage/sync complexity not worth it pre-launch.

### Implementation Sequence (Before Closing Beta)

Current status: Global Search, Goals, Weekly Life Review, memory, proactive weekly insights, Habit selective enhancements, and Backup/Restore file export are now DONE at MVP scope. Continue with beta-close verification next.

1. **Global Search (M38) — DONE MVP**: grouped search across the 4 modules plus Goals.
2. **Goals MVP — DONE MVP**: manual goals with finance category amount and habit completion-rate progress.
3. **Weekly Life Review — DONE MVP** — flagship differentiator (leverages goals + existing insights).
4. **Context memory layer — DONE MVP** — `user_context` memories injected into all generative AI prompts.
5. **Proactive notifications — DONE MVP** — opt-in weekly local notification → deep-link to Weekly Life Review.
6. **Habits selective enhancements — DONE MVP**: "never miss twice" nudge + optional identity field. Observe, then iterate.
7. **DONE MVP:** Backup/Restore file export UI — low risk, trust-building. Restore/import wizard remains follow-up.
8. **Close beta gate** — full verification, coverage pass, real-device visual QA, fresh screenshots, and release-readiness smoke test.

---

## Key Principles For The Roadmap

1. **No more modules.** Goals is the last domain; everything else is intelligence layers on the 4 existing modules.
2. **Calm and low-friction.** Every feature must reduce app fatigue, not add tasks.
3. **Rules before AI.** Deterministic aggregation (sums, counts, rates) never goes to AI. AI explains and suggests only.
4. **Transparent progress.** Goals and insights always show their working (which data, which period, which formula).
5. **Backwards-compatible.** New features must work for existing users with no data migration trauma.
6. **Iterative shipping.** Don't build the whole vision at once. Ship 1–2 items, validate, iterate.
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
- AI provider keys are backend-managed in Supabase Edge Function secrets; the client never stores provider API keys.
- Auth deep links use fixed native custom schemes (`batavasa://auth/callback`, `batavasa://reset-password`) and centralized parsing in `services/authDeepLinks.ts`.
- Category names use canonical DB values and translate at display time.
- Locale-aware formatting must use `getDateFnsLocale(language)` and `getIntlLocale(language)`.
- Create and edit screens are shared via route params.
- Latest local migration is v26: `direction` on `goal` ('reach' vs 'cap'). v25 added `reminder_id` on `finance_plan_item` (bills emit a due-date reminder); v24 added habit `identity`; v23 added `user_context` (AI memory); v22 added finance plan recurrence; v21 added the `goal` table. v19 added `finance_debt` + Lending/Borrowing system categories; v20 deduplicated system categories.
- `enqueue()` is try/catch wrapped for test compatibility.
- Cross-module timeline/life stream is a presentation/read-model layer over domain tables, not a unified `life_events` source-of-truth table.
- **Reminders = action layer, not a co-equal tracked domain (decided 2026-06-25; execution deferred to post-beta).**
  - **Decision:** Keep the Reminders/Tasks module exactly as-is for closed beta. Long-term, Reminders is the shared *action/notification layer* plus a thin generic-task primitive — not a fifth data domain. Each obligation's source of truth lives in its richest home (habit / `finance_plan_item` bill / `finance_debt` / generic task), surfaced together by a future "Today/Agenda" read-model (same read-model-over-domain-tables pattern as the life stream above).
  - **Rationale:** (1) Tasks contribute the least to the Personal-OS correlation thesis — the only data they generate is `completed_count`, which doesn't correlate with mood/spending/habits. (2) A task is structurally just a reminder (`title` + `remind_at` + `recurrence` + notification), no richer model. (3) "Reminding" is a capability the other modules already need.
  - **The codebase is already drifting here (not a from-scratch build):** a `finance_debt` due date already creates a backing Reminders row via `createReminderSvc(...)` and links it (`reminder_id`) — `features/finance/services.ts`. The shared engine is `services/notifications.ts`.
  - **Inconsistencies to resolve when executed:** Habits schedule their own notifications via a *parallel* path (`scheduleHabitNotifications`) instead of the shared layer; there is no unified "Today/Agenda" view; Reminders still ships co-equal-domain UI (Insights + Report screens) that is over-built for a task list. (Bills now emit a reminder via `createReminderSvc` — done 2026-06-26, mirroring debt.)
  - **Order of operations (do NOT remove before replacing):** build/unify the agenda read-model + route bills/habits through the shared layer + make completion act in the source module (tick bill → log transaction, tick debt → record repayment) FIRST; only then retire the standalone-domain framing. All existing reminder data must stay reachable (Cross-Module Rule 1). Cheapest pre-beta-eligible trim, if any: delete the Reminders Insights + Report screens — optional, low value either way.

## Test Commands

```bash
npm test
npm run test:ci
npx tsc --noEmit
```

Use `npx tsc --noEmit` after code changes. Use `npm run test:ci` before release or when touching stores, services, DB queries, sync, or AI builders.

## Recent Changes To Remember

- 2026-06-28 Goals positioning tightened:
  - Goals are now explicitly scoped to metrics BataVasa already measures: Finance amount/cap goals, Habit session counts, Journal entry counts, and completed Task counts.
  - Goal Smart Entry rejects unsupported goals before/after AI parsing (weight, sleep duration, average mood, overdue caps, debt by person, net worth, true streak) instead of forcing them into misleading bindings.
  - Finance Goal copy now explains the current signed-transaction model: income entries count for income categories; expense/set-aside entries count for other categories; opposite-sign entries are ignored.
- 2026-06-26 Goals refinements (pre-beta-close, three bounded fixes):
  - **Direction (reach vs cap).** `goal.direction` (migration v26, default 'reach'). `goalProgress` now returns `direction` + `status` ('on_track' | 'reached' | 'over'): a 'cap' goal (e.g. dining < 2M) is `over` when it exceeds its ceiling instead of looking like progress. Detail screen shows the bar red + "over/within limit"; the form exposes a Reach/Stay-under toggle for finance goals only.
  - **Auto-complete + celebrate.** A 'reach' goal that hits its target is persisted `done` once (in `hydrateGoal` → `autoCompleteIfReached`), so lists/detail/reports/AI all see it. `goalsStore` fires a 🎉 toast when a goal transitions active→done between snapshots (first load has empty `prev`, so old completions don't re-toast).
  - **Habit goals: completion_count + hack cleanup.** Habit binding now supports `completion_count` (a raw number of sessions, e.g. "meditate 30×") alongside `completion_rate` (% of scheduled days). Form has a Consistency-%/Sessions toggle; the parser detects "30 buổi/sessions" → count and "90%" → rate deterministically. The scattered `<20 → 100` clamps collapsed into one `normalizeHabitRateTarget` keyed on the binding aggregation.
  - Verification: `npx tsc --noEmit` clean; `npm test` 586 passed across 46 suites (+5 goal-progress tests for direction/status/count binding).
- 2026-06-26 Bill reminders + journal anniversaries (two reminder gaps closed):
  - **Bills now notify.** `finance_plan_item` gets a `reminder_id` (migration v25); `createPlanItem`/`updatePlanItem`/`deletePlanItem`/`restorePlanItem` create/reconcile/cancel a backing reminder for **expense** bills, mirroring the debt→reminder pattern. Pure `planItemReminderSchedule()` maps `due_day` + recurrence → next 09:00 fire time (monthly recurs, once fires for its `applies_month`, day clamps to month length). Synced (dynamic-column sync), Supabase RLS + ALTER added.
  - **Journal "on this day".** New `services/anniversaryNotifications.ts`: opt-in yearly nudge on the anniversary of `is_important` journal entries. Pure `computeAnniversaryPlan()` (next anniversary ≥1yr, within a 35-day horizon, capped, sorted). Privacy-safe: gated on `hideJournals`, body carries **no journal content** (only the year count). Reconciled on app start/foreground in `_layout.tsx`; tap routes to `/journal?id=`. Settings toggle `anniversaryReminders` (default off) + 5 i18n keys × 6 languages.
  - Verification: `npx tsc --noEmit` clean; `npm test` 581 passed across 46 suites. New `__tests__/reminderScheduling.test.ts` covers both pure functions.
- 2026-06-20 Auth deep-link hardening:
  - Added `services/authDeepLinks.ts` as the single place for auth redirect URLs and query/hash token parsing. Native Google OAuth uses `batavasa://auth/callback`; native password recovery uses `batavasa://reset-password`; web still uses Expo-generated web URLs.
  - `store/authStore.ts`, `useGoogleAuthCallback`, and `usePasswordRecoveryLink` now share the same parser, so PKCE `?code=...`, implicit `#access_token=...`, and mixed query/hash URLs are handled consistently.
  - Added `app.config.js` so `@react-native-google-signin/google-signin` is wired only when an iOS URL scheme can be resolved from env (`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` or `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME`), avoiding config-plugin build failures when iOS Google is not configured.
  - Docs updated: `docs/auth-setup.md` and `docs/security.md` now specify native reset redirect as `batavasa://reset-password`. Remaining work is manual verification on device/emulator: Google sign-in/callback/session restore and reset-email deep link -> set new password.
  - Verification: `npx expo config --type public` passed; `npx jest auth --runInBand` passed; `npx tsc --noEmit` clean; `npm test -- --runInBand` passed with 530 tests across 44 suites.
- 2026-06-20 Smart teaser on the weekly-review notification:
  - `services/weeklyTeaser.ts`: deterministic one-glance week summary (expense + % vs last week, habit completions, avg mood, overdue tasks) from SQLite, formatted as a language-proof icon+number line (`💸 2.1M (−12%)  ✅ 5  🙂 3.9/5  ⏰ 2`). Stamped onto the scheduled notification body in `proactiveNotifications.ts` (fallback to the static localized body when empty); re-stamped on app start + every foreground (`app/_layout.tsx`). Pure `formatWeeklyTeaser` is tested (`__tests__/weeklyTeaser.test.ts`). No background task — reliable + Expo-Go-safe.
  - Verification: `npx tsc --noEmit` clean; `npm test -- --runInBand` passed with 521 tests across 42 suites.
- 2026-06-20 Assistant long-term ("better version") context:
  - `services/ai/longTermContext.ts` builds **deterministic per-year rollups** (finance income/expense/top category, habit done/skip/count, journal entries/avg mood/important, task completion) straight from SQLite — the whole history, not the paginated store — so the assistant can answer "what did I do over the past year?" and compare the user across years. Pure `formatLongTermSummary` is unit-tested; the async `buildLongTermSummary` queries the DB. Finance counts the primary currency only (no cross-currency summing without FX).
  - `AssistantScreen` loads the block once on mount and appends it to the assistant context; `buildAssistantSystemPrompt` now invites year-over-year comparison ("growing toward a better version"). New `assistant_prompt_growth` quick prompt × 6 languages.
  - Verification: `npx tsc --noEmit` clean; `npm test -- --runInBand` passed with 517 tests across 41 suites.
- 2026-06-20 Proactive weekly-review notification (M37):
  - Opt-in (default OFF) weekly local notification that deep-links to `/weekly-review`. Chosen over a background task for reliability and calm. Pure trigger math in `services/proactiveSchedule.ts` (tested); scheduling/cancel/reconcile in `services/proactiveNotifications.ts`; tap routing in `features/notifications/useNotificationRouting.ts`; reconciled at app start in `app/_layout.tsx`.
  - Settings: `proactiveWeeklyReview` + `proactiveWeeklyDay` (1=Sun…7=Sat) + `proactiveWeeklyHour`, with a Weekly review section in `SettingsScreen` (toggle + locale-aware weekday chips + hour stepper). 7 i18n keys × 6 languages (`weekly_review_reminder*`, `weekly_review_notif_*`, `weekly_review_needs_notifications`).
  - Verification: `npx tsc --noEmit` clean; `npm test -- --runInBand` passed with 513 tests across 40 suites.
- 2026-06-20 Context memory layer (AI personalization):
  - New `user_context` table (migration v23) of short user-authored memories (`goal` / `preference` / `fact`). DB layer in `database/context/`, feature CRUD in `features/context/`, store in `store/contextStore.ts`.
  - `services/ai/userContextPrompt.ts` exposes `withUserContext()` and a DB-decoupled cache (kept in sync by the store, warmed in `app/_layout.tsx`). Injected into the assistant, weekly life review, cross-module analysis, finance/habit/journal/reminder insights, finance reports, and goal coach. NOT injected into deterministic smart/universal parsers.
  - `AIMemoryScreen` at `/ai-memory` (linked from AI settings): add/edit/delete + sync toggle (`syncContext`) + JSON export + wipe (Cross-Module Rule 1). Registered in `services/sync.ts` and `docs/supabase-setup.sql` (RLS). 16 i18n keys × 6 languages.
  - Verification: `npx tsc --noEmit` clean; `npm test -- --runInBand` passed with 505 tests across 38 suites. Note: a missing transitive dep (`expo-asset`) had to be reinstalled to run the AI-builder suites — keep `node_modules` fully installed.
- 2026-06-20 Assistant module context:
  - Added `services/ai/assistantContext.ts`, a deterministic context builder for Finance, Tasks, Habits, Journals, and Goals. `AssistantScreen` now sends this grounded snapshot to the AI with stricter prompt rules and lower temperature, so answers can reference existing user data instead of generic advice.
  - Verification: `npx tsc --noEmit` clean; `npm test -- --runInBand` passed with 500 tests across 37 suites.
- 2026-06-19 (cont.) Weekly Life Review MVP:
  - Added `/weekly-review`, a connected weekly report across Goals, Finance, Habits, Journals, and Tasks. The review shows deterministic metrics first and uses AI only for the narrative explanation.
  - Home `quick_reports` now opens Weekly Review. Added `__tests__/weeklyLifeReview.test.ts` for the deterministic snapshot builder.
  - Verification: `npx tsc --noEmit` clean; 491 tests across 35 suites pass.
- 2026-06-19 (cont.) finance plan polish:
  - Finance bottom-nav active icon tint now uses the same finance module color intensity as the page UI.
  - Finance plan items now support a monthly checkbox: checked = repeats monthly; unchecked = one-time item for the current month only. SQLite migration v22 and Supabase setup SQL add `recurrence` + `applies_month`.
  - Verification: `npx tsc --noEmit` clean; 489 tests across 34 suites pass.
- 2026-06-19 (cont.) managed-AI finalization + home dedup:
  - AI is now fully **backend-managed**: removed the in-app provider chooser. `AISettingsScreen` keeps only the parse-confirm toggle (`aiAutoConfirm`); the main Settings AI section is a single link (the duplicate inline toggle was removed). `ai_server_managed` copy updated in all 6 languages.
  - Removed the AI step from onboarding (now 2 steps: language → feature intro). Provider + key are set by the publisher via Supabase secrets, so there is nothing for the user to configure.
  - Added the missing **Edge Functions** the client already calls: `supabase/functions/ai-chat` (chat-completion proxy) + `supabase/functions/ai-transcribe` (Whisper proxy) + `supabase/functions/_shared/` (CORS + server provider registry) + `supabase/config.toml` (verify_jwt = true). Provider is resolved server-side via the `AI_PROVIDER` secret; key from `<PROVIDER>_API_KEY`; optional `AI_MODEL` override. Setup steps in `docs/ai-integration.md`.
  - Renamed the reminders module insight title to "Task" wording (`reminder_insight_title`) across all 6 languages to match the Reminders→Tasks/Công việc rename.
  - Home: the "Phân tích thông minh" AI-insight card action now opens `/analysis` (was `/chat`), removing the duplicate assistant entry point next to the "Trợ lý" quick action.
- 2026-06-18/19 New UI "Personal OS Console" overhaul + rollout:
  - 2026-06-18: redesigned the main screens (Home/Daily Digest, the 4 module list screens, Settings, Analysis, Auth) around a new `components/ui/` console design system (`AppHeader`, `CommandBar`, `ModuleTabBar`, `SectionHeader`, `ListRow`, `ModuleOverview`, `AIInsightCard`, `Chip`, `StatusPill`, `SignalsTimeline`, `QuickActionRow`, `BrandMark`/`Sparkle`). Retuned `design/tokens.ts`, `design/themes.ts`, `design/moduleColors.ts`. Rules in `docs/design-system.md` ("UI1 Personal OS Console").
  - 2026-06-19: finished the rollout on the secondary (pushed) screens. Added `components/ui/EmptyState.tsx` (tinted module-color icon badge + title/body/optional CTA) and replaced the old 48px-emoji empty states across all 4 AI insight screens (finance/habits/journals/reminders) and all 4 report screens (finance/habits/journals/reminders) + AnalysisScreen. AI result cards now carry a `Sparkle` "AI INSIGHT" header for console identity. No new i18n keys (reused existing titles).
  - 2026-06-19 (cont.) language + settings polish: fixed the home screen mixing Vietnamese into the otherwise-translated UI — `DailyDigestScreen` had hardcoded Vietnamese goal text + an untranslated `LIFE_GOALS` rotation; restored the existing `home_ai_tip_review/habits/empty` keys, used `t.ai_insights` for the AI card label, and made the signals axis labels locale-neutral 24h (`6/9/12/15/18/21` instead of English `AM/PM`). Unified settings sub-screen section headers (`AppearanceScreen`, `AISettingsScreen`, `HelpScreen`) to the UPPERCASE-tracked style used by `SettingsScreen` and the list/home screens.
  - 2026-06-19 (cont.) signals + form audit: `SignalsTimeline` lanes now render a module-color **icon** (language-proof) instead of a tiny truncated text label; gutter tightened. Audited all 5 create/edit forms (Habit/Journal/Reminder/Debt/Category) — already on the new design system (tokens, `t.*`, Feather icon-chip headers, `DateRow`, `ConfirmEntrySheet`); only fixes needed were JournalForm's date pill (📅 emoji → Feather calendar icon) and CategoryForm's delete button (added trash icon). Mood/habit-preset emojis are intentional data, left as-is.
  - Deleted dead `app/batavasa.tsx` ("Hỏi BataVasa" guide) + its `Stack.Screen` registration — it was hardcoded Vietnamese and unreachable (no `router.push('/batavasa')`; the home assistant routes to `/chat` → `AssistantScreen`). This removed the last hardcoded-Vietnamese user-facing string. The `batavasa://` deep-link scheme (auth callback / reset-password) is unrelated and untouched.
  - Verification: `npx tsc --noEmit` clean; 476 tests across 31 suites pass.
- 2026-06-13 follow-up pass (dual notifications, smart-entry missing fields):
  - Reminders now schedule a second notification at the event time when `advance_minutes > 0` (early warning + at-deadline ping). Covers debts, recurring bills, and manual reminders.
  - Smart entry across modules: missing fields prompt the user ("Bổ sung / Lưu với mặc định") instead of silent drops or validation errors. `universalEntry.ts` tracks `missing` per candidate; `aiParser.ts` (reminders) falls back title→input text and flags missing dates; missing reminder date can save to the unscheduled inbox; finance smart entry without an amount asks for the amount specifically. Debt-book and finance-plan parsing are kept in Finance-local flows, not Universal Add.
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
