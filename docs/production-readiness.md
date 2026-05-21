# Production Readiness — BataVasa

> Tracking checklist for moving all modules from MVP → production. Last updated: 2026-05-21.

**Current state:** 🟢 Beta closed · 🔴 chưa thể public launch.

| Tier | Definition | Status |
|---|---|---|
| MVP cá nhân | Dùng riêng cho mình | ✅ ready |
| Beta closed | 10–50 friends/family | ✅ ready (B1 ✅ B2 ✅ B5 partial) |
| Public launch | Open user base | ❌ cần H18 + ≥50% MEDIUM |

---

## ❌ BLOCKER

- [x] **B1. Auth — DONE (2026-05-21)** 🔁 cross-module · `docs/auth-setup.md` — Supabase Auth (email/password, login wall) hoàn chỉnh: `services/supabase.ts`, `store/authStore.ts`, `services/identity.ts`, `features/auth/AuthScreen.tsx`, login gate `app/_layout.tsx`, Settings → Account. i18n 6 ngôn ngữ. `.env.local` đã điền (Supabase project live). **Còn lại:** chạy end-to-end verify trên thiết bị thật.
- [x] **B2. Cloud sync — DONE (2026-05-21)** 🔁 cross-module (Rule 1) · `docs/sync-offline.md` — Offline-first sync engine hoàn chỉnh: `database/sync/schema.ts` (sync_queue table + dedup index), `database/sync/queue.ts` (enqueue/getPending/markSynced/markFailed), `services/sync.ts` (drain worker, AppState listener, module toggle check), migration v8. Tất cả 4 module services (finance/habits/journals/reminders) đã wire enqueue sau mỗi create/update/delete/wipe. `startSyncWorker` chạy sau auth init. Supabase tables + RLS: `docs/supabase-setup.sql`. **Còn lại:** chạy SQL trên Supabase dashboard → verify end-to-end.
- [ ] **B5. Tests — IN PROGRESS (2026-05-21)** 🔁 cross-module · `docs/ops.md#testing` — Coverage gate wired (`npm run test:ci`, thresholds in `jest.config.js`). **184 tests / 19 suites pass. CI coverage floor ratcheted to 37% statements / 35% branches / 31% functions / 39% lines.** Added finance/reminders service tests and finance/reminders query tests. **Còn lại:** habits/journals DB query tests, sync/settings/core DB tests, AI insight builders → đạt 70% global gate.

---

## ⚠️ HIGH

- [x] **H12. Web SQLite Firefox warning — DONE 2026-05-19** 🔁 cross-module · `DailyDigestScreen` shows a non-blocking web Firefox banner because SQLite persistence may be in-memory there. Covered by `__tests__/webPersistence.test.ts`.
- [x] **H16. Onboarding flow — DONE (2026-05-21)** — `features/home/components/OnboardingModal.tsx` (3-step: language → AI key → feature intro). Triggered khi user chưa có AI key. `DataManagementScreen` wired vào Settings.
- [x] **H17. Biometric lock — DONE (2026-05-21)** — `expo-local-authentication` + `services/biometric.ts` (getBiometricSupport, authenticate). `components/BiometricLockScreen.tsx` (full-screen lock, auto-trigger, retry). `settingsStore.biometricLock` persisted SQLite. `app/_layout.tsx`: AppState timer 30s → `setLocked(true)`. Toggle Settings → Privacy với check device support. i18n 9 keys × 6 ngôn ngữ.
- [ ] **H18. App Store assets — IN PROGRESS (2026-05-21)** — Production icon/splash/favicon replaced from template assets. Privacy policy source: `docs/privacy-policy.md`. Store copy + screenshot checklist: `docs/store-listing.md`. `app.json` includes `extra.privacyPolicyUrl` / `extra.supportUrl`. **Còn lại:** capture production screenshots on device/emulator + fill App Store Connect / Play Console metadata.
- [x] **H19. Voice force-confirm — DONE 2026-05-19** — `QuickAddScreen` voice input luôn mở ConfirmSheet trước khi lưu, kể cả khi `aiAutoConfirm=false`. Confirmed voice transactions giữ `source: 'voice'`.

---

## 🟡 MEDIUM

- [ ] **M19. Duplicate detection** có thể false positive — finance-specific
- [ ] **M21. Backup/restore** 🔁 cross-module · liên quan B1+B2
- [x] **M28. `wipeAllData` sync tombstone — DONE (2026-05-21)** — wipe ops enqueue `operation: 'wipe'` vào sync_queue → worker gọi Supabase DELETE where user_id. Tất cả 4 modules.
- [ ] **M29. FX conversion (multi-currency reporting)** — finance-specific. Hiện tại: mỗi tx hiện bằng currency của nó, summary group by currency (Option A). Future: tích hợp FX API + cache + offline fallback → summary 1 currency duy nhất.
- [x] **M35. Analytics service — DONE 2026-05-19** — `services/analytics.ts` exists as a privacy-safe allow-list wrapper with pluggable transport + Sentry breadcrumbs. Tracks `app_open` / `app_background`; covered by `__tests__/analytics.test.ts`.
- [ ] **M36. Cross-module behavioral patterns** — USP lớn nhất của app chưa được implement. VD: "Tuần này chi nhiều hơn 40% vào ngày journal có mood 'stressed'". Cần pipeline aggregate Finance × Habits × Journals. Đã có trong Sprint 3.
- [ ] **M37. Proactive push insights** — AI chỉ phản hồi khi user hỏi. Cần weekly background job gửi notification với báo cáo tóm tắt ("Bạn chi 2.3tr cho ăn uống tuần này, cao hơn tuần trước 18%"). Dùng `expo-task-manager` (đã cài).
- [ ] **M38. Global search** — Gõ "cà phê" → hiện tất cả transactions + journal entries liên quan. Đây là điểm "personal OS" thực sự, phân biệt với app đơn lẻ.

---

## 🟢 LOW / Nice-to-have

- [ ] **L1. Voice cancel gesture** — Swipe-up khi đang record để cancel (không lưu). UX quen thuộc như iOS Voice Memo.
- [x] **L2. Haptic feedback — DONE 2026-05-19** — `expo-haptics` wired via `services/haptics.ts` for voice start/stop and successful saves across QuickAdd, UniversalAdd, finance categories, reminders, journals, habits, and AI settings.
- [ ] **L3. Home screen widget** — Widget nhỏ hiển thị "Hôm nay: 150k" + habit streak. Daily engagement loop mạnh nhất.
- [ ] **L4. Monetization / API proxy** — AI features dùng OpenAI API tốn tiền. Cần quyết định: BYO-key (hiện tại) vs subscription model vs hosted proxy. Cần quyết định trước public launch.

---

## ✅ OK — production-quality

- ✅ Folder structure & layer separation (UI → hooks → services → DB)
- ✅ `Result<T, AppError>` pattern, no-throw across boundaries
- ✅ SQLite setup: WAL + FK ON + migration với `PRAGMA user_version` (v8, sync_queue)
- ✅ i18n 6 ngôn ngữ (vi/en/zh/ja/ko/fr) + category translation
- ✅ Multi-provider AI (OpenAI, Groq, Gemini, Ollama) via unified `chatCompletion()`
- ✅ AI prompts: language directive + local datetime + timezone offset
- ✅ Currency-aware helpers (`centsToDisplay` / `displayToCents` / `formatAmount`)
- ✅ Wipe pattern: double-confirm + clear store + re-seed
- ✅ Location wrapper cross-platform + null-safe (`services/location.ts`)
- ✅ TypeScript strict
- ✅ Logger PII scrub + Sentry forwarding
- ✅ Zod validation cho all writes
- ✅ Period summary với click-filter (Today/Week/Month/All)
- ✅ Theme system (5 themes × light/dark)
- ✅ Finance, Reminders, Journals, Habits modules: full CRUD + export + wipe
- ✅ Daily Digest home screen + Universal Add Sheet (text + voice)
- ✅ Local push notifications (Reminders, expo-notifications)
- ✅ ErrorBoundary (class component) wraps Stack + Sentry captureException
- ✅ Pagination (PAGE_SIZE=50, loadMore, hasMore state) — Finance
- ✅ Smart Entry date parser (`services/dateParser.ts`) — deterministic, 6 ngôn ngữ
- ✅ Locale-aware formatters (date-fns + Intl, derived từ settingsStore.language)
- ✅ Category management UI + budget progress bar
- ✅ AI Settings: multi-provider key management, validation, gate khi thiếu key
- ✅ Accessibility labels (roles, states, hints) — Finance + Journals
- ✅ Voice input — 6 màn hình, end-to-end (record → Whisper → parse → confirm → save)
- ✅ Voice force-confirm — QuickAdd voice luôn qua ConfirmSheet và lưu `source: 'voice'`
- ✅ VoiceButton: ChatGPT-style waveform animation khi recording, Ionicons mic icon
- ✅ advance_minutes (nhắc trước) — Reminder module (DB + UI + NL parser + i18n)
- ✅ Per-module cloud sync toggle UI — Settings screen + settingsStore persisted
- ✅ Reports: 4-tab period selector (Weekly/Monthly/Yearly/Custom) với navigation
- ✅ Web Firefox SQLite warning banner (H12) + helper tests
- ✅ Haptic feedback wrapper for voice and save confirmation (L2)
- ✅ Analytics service allow-list wrapper + app lifecycle events (M35)
- ✅ Cloud sync engine: sync_queue (SQLite) → Supabase upsert, LWW, AppState drain, module toggles (B2)
- ✅ Onboarding modal: 3-step (language → AI key → features), triggered on first launch (H16)
- ✅ Data Management screen: export/wipe per module với double-confirm
- ✅ B1/B2 validation service (`services/b1b2-validate.ts`) + smoke tests
- ✅ H18 partial: production icon/splash/favicon + privacy policy + store listing source copy
- ✅ Test infra: Jest coverage gate (`test:ci`) + per-file 90% locks on pure helpers; 184 tests across 19 suites; finance/reminders service + query coverage added (B5 partial)

---

## Scores

| Tiêu chí | Score | Ghi chú |
|---|---|---|
| Architecture | 9/10 | Auth + sync layer hoàn chỉnh, offline-first |
| Code quality | 7/10 | TypeScript strict, Result pattern, thiếu DB/service tests |
| UX hoàn chỉnh | 8/10 | Voice + CRUD + onboarding + reports + biometric; thiếu App Store assets |
| Security | 8/10 | Auth live (Supabase), PII scrub, RLS, biometric lock; cần device E2E verify |
| Reliability | 6/10 | Sync engine + 184 tests; finance/reminders service + query layers covered; còn core/sync/settings/AI insight tests |
| **Production-ready** | **6/10** | Beta closed ✅; cần H18 + ≥50% MEDIUM cho public launch |

---

## Sprint plan

**Sprint 1 ✅ COMPLETE (2026-05-18) — Closed beta prep:**
- ✅ Edit transaction (Rule 7 CRUD)
- ✅ ConfirmEntrySheet + Smart Entry date parser
- ✅ Error Boundary + Sentry
- ✅ Pagination + transaction tap-to-edit
- ✅ Locale formatters + hardcoded VN strings + API key gates

**Sprint 2 ✅ COMPLETE (2026-05-19) — Feature completion:**
- ✅ Voice input — 6 màn hình, end-to-end
- ✅ advance_minutes cho Reminders
- ✅ Reports 4-tab (Weekly/Monthly/Yearly/Custom)
- ✅ AI language enforcement + multi-currency display

**Sprint 3 ✅ PHẦN LỚN COMPLETE (2026-05-21) — Beta launch:**
1. ✅ B1 — Auth (Supabase email/password + login wall + i18n 6 ngôn ngữ)
2. ✅ B2 — Sync engine (sync_queue, drain worker, 4 modules, Supabase tables + RLS)
3. 🔄 B5 — Tests helpers ≥90% ✅; finance/reminders service + query tests ✅; còn core/sync/settings/AI insight tests (target 70% global)
4. ✅ H16 — Onboarding flow (3-step modal)
5. ✅ H17 — Biometric lock
6. ✅ H19 — Voice force-confirm fix

**Sprint 4 — Module completion + public prep:**
0. Public launch polish sequence:
   - 1) Empty states + permission preflows + reports screenshot readiness + data management clarity
   - 2) Store screenshots + metadata final pass
   - 3) Error message/i18n audit
   - 4) Settings information architecture cleanup
   - 5) Accessibility and dynamic text pass
   - 6) Micro-interactions/loading/success states polish
1. Habits module: streak tracking + AI insight
2. M36 — Cross-module behavioral patterns (Finance × Habits × Journals)
3. M37 — Proactive weekly push insights
4. M38 — Global search
5. M21 — Backup/restore (requires B1+B2)
6. M28 — wipeAllData sync tombstone
7. M29 — FX conversion display currency
8. H18 — App Store assets + submission
9. L4 — Monetization decision
