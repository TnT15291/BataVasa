# Production Readiness — BataVasa

> Tracking checklist for moving all modules from MVP → production. Last updated: 2026-05-21.

**Current state:** 🟢 MVP cá nhân dùng được · 🔴 chưa thể public launch.

| Tier | Definition | Status |
|---|---|---|
| MVP cá nhân | Dùng riêng cho mình | ✅ ready |
| Beta closed | 10–50 friends/family | ❌ cần B5 (tests) |
| Public launch | Open user base | ❌ cần B1 (auth), B2 (sync) + tất cả HIGH + ≥50% MEDIUM |

---

## ❌ BLOCKER

- [ ] **B1. Không có auth** 🔁 cross-module · `docs/security.md#authentication` — `user_id: null` mọi nơi → multi-user impossible, RLS Supabase vô nghĩa
- [ ] **B2. Không có cloud sync** 🔁 cross-module (Rule 1) · `docs/sync-offline.md` — `sync_queue` table chưa tồn tại, Supabase chưa wire → mất phone = mất sạch data
- [ ] **B5. Tests — IN PROGRESS (2026-05-21)** 🔁 cross-module · `docs/ops.md#testing` — Coverage gate wired (`npm run test:ci`, thresholds in `jest.config.js`). **153 tests / 14 suites pass.** Pure helpers (`dateParser`, `locale`, `uuid`, `fx`, `aiLanguage`, `reminderParser`) ✅ ≥90% target. AI response parsers (reminder/habit/journal) tested against valid + malformed JSON fixtures. **Còn lại:** `database/*/queries.ts` (cần in-memory SQLite), `features/{finance,reminders}/services.ts`, AI insight builders → để đạt 70% gate trên services/DB (global hiện ~17%, floor ratchet đã set).

---

## ⚠️ HIGH

- [x] **H12. Web SQLite Firefox warning — DONE 2026-05-19** 🔁 cross-module · `DailyDigestScreen` shows a non-blocking web Firefox banner because SQLite persistence may be in-memory there. Covered by `__tests__/webPersistence.test.ts`.
- [ ] **H16. Onboarding flow** — User mở app lần đầu không có hướng dẫn nào. Cần 3-step: chọn language → nhập AI key → giới thiệu tính năng. Hiện tại user bị "thrown in" vào DailyDigest mà không biết phải làm gì.
- [ ] **H17. Biometric lock** — App chứa data tài chính nhạy cảm. Cần Face ID / fingerprint (`expo-local-authentication`). Toggle trong Settings → Privacy. Block app khi background lâu hơn 30 giây.
- [ ] **H18. App Store assets** — App icon production-ready, splash screen, privacy policy URL, screenshots chưa có. Cần trước khi submit App Store / Play Store.
- [x] **H19. Voice force-confirm — DONE 2026-05-19** — `QuickAddScreen` voice input luôn mở ConfirmSheet trước khi lưu, kể cả khi `aiAutoConfirm=false`. Confirmed voice transactions giữ `source: 'voice'`.

---

## 🟡 MEDIUM

- [ ] **M19. Duplicate detection** có thể false positive — finance-specific
- [ ] **M21. Backup/restore** 🔁 cross-module · liên quan B1+B2
- [ ] **M28. `wipeAllData` không có sync tombstone** 🔁 cross-module (Rule 1) — đợi sync engine
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
- ✅ SQLite setup: WAL + FK ON + migration với `PRAGMA user_version` (v7)
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
- ✅ Test infra: Jest coverage gate (`test:ci`) + per-file 90% locks on pure helpers; 153 tests across 14 suites (B5 partial)

---

## Scores

| Tiêu chí | Score | Ghi chú |
|---|---|---|
| Architecture | 8/10 | Layer separation tốt, còn thiếu auth layer |
| Code quality | 7/10 | TypeScript strict, Result pattern, thiếu tests |
| UX hoàn chỉnh | 5/10 | Voice input + 4 modules CRUD, thiếu onboarding |
| Security | 5/10 | PII scrub, thiếu auth + biometric |
| Reliability | 4/10 | Coverage gate + 153 tests (helpers ≥90%); DB/sync layer still untested, no backup |
| **Production-ready** | **3/10** | Blockers B1+B2+B5 chưa xong |

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

**Sprint 3 (2-3 tuần) — Beta launch:** ← CURRENT
1. B1 — Auth (Supabase email/OAuth)
2. B2 — Sync engine (sync_queue + Supabase mirror)
3. B5 — Tests cho service + DB layer (target 70%) — 🔄 helpers + parsers done; DB queries + feature services còn lại
4. H16 — Onboarding flow
5. H17 — Biometric lock
6. ✅ H19 — Voice force-confirm fix (QuickAddScreen)

**Sprint 4 — Module completion + public prep:**
1. Habits module: streak tracking + AI insight
2. M36 — Cross-module behavioral patterns (Finance × Habits × Journals)
3. M37 — Proactive weekly push insights
4. M38 — Global search
5. M21 — Backup/restore (requires B1+B2)
6. M28 — wipeAllData sync tombstone
7. M29 — FX conversion display currency
8. H18 — App Store assets + submission
9. L4 — Monetization decision
