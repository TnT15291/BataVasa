# Production Readiness — Finance Module

> Tracking checklist for moving Finance from MVP → production. Tick boxes as items are fixed. Audit date: 2026-05-18.

**Current state:** 🟢 MVP cá nhân dùng được · 🔴 chưa thể public launch.

| Tier | Definition | Status |
|---|---|---|
| MVP cá nhân | Dùng riêng cho mình | ✅ ready |
| Beta closed | 10–50 friends/family | ❌ còn cần B5 (tests) + H12 (Firefox SQLite) |
| Public launch | Open user base | ❌ cần thêm B1 (auth), B2 (sync) + tất cả HIGH + ≥50% MEDIUM |

---

## ❌ BLOCKER

- [ ] **B1. Không có auth** 🔁 cross-module · `docs/security.md#authentication` — `user_id: null` mọi nơi → multi-user impossible, RLS Supabase vô nghĩa
- [ ] **B2. Không có cloud sync** 🔁 cross-module (Rule 1) · `docs/sync-offline.md` — `sync_queue` table chưa tồn tại, Supabase chưa wire → mất phone = mất sạch data
- [x] **B3. Rule 5 (ConfirmEntrySheet) — DONE 2026-05-18** — `<ConfirmEntrySheet>` + `aiAutoConfirm` setting wired vào Smart Entry. Edit/Save/Cancel buttons, echo raw input, parsed summary
- [x] **B4. Edit transaction — DONE 2026-05-18** — Generalized as Rule 7 (CRUD completeness) in CLAUDE.md + architecture.md
- [ ] **B5. Không có tests** 🔁 cross-module · `docs/ops.md#testing` — 0% coverage → refactor là gambling. Coverage gate 70%/90% spec'd

---

## ⚠️ HIGH

- [x] **H6. Smart Entry matching yếu — DONE 2026-05-18** — `matchCategory()` trong `features/finance/i18n.ts`: ưu tiên exact English DB name → exact translated name → substring fallback. AI prompt yêu cầu `category_hint` phải là exact string từ danh sách. Không còn silent fail.
- [x] **H7. Date parser cho Smart Entry — DONE 2026-05-18** — `services/dateParser.ts`: `extractDateFromText()` xử lý ISO, DD/MM/YYYY, DD/MM, named months (EN/FR), CJK/Korean numeric, Vietnamese tháng/ngày, relative keywords 6 ngôn ngữ (hôm qua/yesterday/昨日/어제/hier/前天 + các variant). Chạy deterministic trước AI call, không phụ thuộc model.
- [x] **H8. Locale-aware DateRow — DONE 2026-05-18** — `services/locale.ts` thêm `getDateFnsLocale()`. DateRow + ReportsScreen + QuickAddScreen confirm sheet đều dùng locale từ `settingsStore.language`
- [x] **H9. Locale-aware formatAmount — DONE 2026-05-18** — `services/locale.ts` thêm `getIntlLocale()`. `formatAmount(cents, currency, language)` + AmountText pass language. JPY/KRW thêm fractionDigits handling. `fmtAI()` cũng fix toLocaleString
- [x] **H10. Pagination — DONE 2026-05-18** — `financeStore`: PAGE_SIZE=50, `loadMoreTransactions()` appends next page, `txHasMore`/`txLoadingMore` state. `TransactionListScreen`: `onEndReached` + footer spinner/button on "all" period.
- [x] **H11. Error Boundary — DONE 2026-05-18** — `components/ErrorBoundary.tsx` class component wraps Stack in `app/_layout.tsx`. Catches render errors, shows retry UI, forwards to Sentry via `captureException`.
- [ ] **H12. Web SQLite không persist với Firefox** 🔁 cross-module · `docs/database.md#web-fallback` — đã document banner advice
- [x] **H13. Smart Entry button hiện cả khi không có API key — DONE 2026-05-18** — `QuickAddScreen`: check key async on mount, button redirects to AI Settings when no key, panel hidden entirely.
- [x] **H14. AISettings còn hardcoded VN string — DONE 2026-05-18** — tất cả string trong `AISettingsScreen` đi qua `t.<key>`, thêm `key_invalid_prefix` + các key mới vào 6 file ngôn ngữ.
- [x] **H15. Tap row transaction = no action** 🔁 cross-module (Rule 7) · DONE 2026-05-18 — tap mở edit, applies to all modules

---

## 🟡 MEDIUM

- [ ] **M16.** Không có category management — finance-specific
- [ ] **M17.** Không có budget/limits per category — finance-specific
- [x] **M18. Reports/Insights key gate — DONE 2026-05-18** — `InsightsScreen` + `ReportsScreen`: check key on mount, show 🔑 empty state + "Go to Settings →" button khi không có key. `NO_API_KEY` error gracefully flips UI thay vì alert.
- [ ] **M19.** Duplicate detection có thể false positive — finance-specific
- [ ] **M20.** Không có data export (GDPR) 🔁 cross-module (Rule 1 extended) · `exportAllData()` per module
- [ ] **M21.** Không có backup/restore 🔁 cross-module · liên quan auth + sync
- [x] **M22. Accessibility labels — DONE 2026-05-18** — `TransactionRow`: `accessibilityRole="button"` + `accessibilityLabel` (category + merchant + amount) + `accessibilityHint`. `TransactionListScreen`: period tabs `role="tab"` + `accessibilityState.selected`, AI buttons + FAB `role="button"` + label.
- [x] **M23. MoodSelector accessibility — DONE 2026-05-18** — `accessibilityRole="radiogroup"` trên View, mỗi mood `role="radio"` + `accessibilityLabel={label}` + `accessibilityState.checked`. Emoji/label text đánh dấu `importantForAccessibility="no"` để tránh đọc đôi.
- [x] **M24. API key validation — DONE 2026-05-18** — `AISettingsScreen` validate keyPrefix trước khi save, alert rõ format đúng. `providers.ts`: Gemini prefix fix `'AI'` → `'AIza'`. Translation key `key_invalid_prefix` trong 6 ngôn ngữ.
- [x] **M25. AmountText color override — DONE 2026-05-18** — Thêm `color?: string` prop; style order đổi thành `[fontVariant/fontWeight, style, { color }]` để `color` prop luôn thắng, `style` vẫn override font/size. Callers trong `TransactionListScreen` chuyển sang dùng `color=` prop thay `style={{ color }}`.`
- [x] **M26. Loading states — DONE 2026-05-18** — `useFinanceBootstrap()` giờ trả `boolean` (true khi catState/txState chưa `'ready'`). `TransactionListScreen` dùng flag này: empty component hiện `<ActivityIndicator>` khi đang load thay vì "No transactions" misleading.
- [x] **M27. Sentry wired — DONE 2026-05-18** — `@sentry/react-native` installed. `Sentry.init()` in `_layout.tsx` guarded by `EXPO_PUBLIC_SENTRY_DSN`. `logger.ts` forwards `warn`→breadcrumb, `error`→breadcrumb+captureMessage. `ErrorBoundary` calls `captureException`.
- [ ] **M28.** `wipeAllData` không có sync tombstone 🔁 cross-module (Rule 1) — đợi sync engine
- [ ] **M29.** FX conversion (multi-currency reporting) — finance-specific. Hiện tại: mỗi tx hiện bằng currency của nó, summary group by currency (Option A). Future: tích hợp FX API (exchangerate.host / frankfurter.app) + cache + offline fallback → cho phép summary 1 currency duy nhất. Cần Settings tách "Display currency" vs "Default for new entries"

---

## 🟢 OK (đã production-quality)

- ✅ Folder structure & layer separation (UI → hooks → services → DB)
- ✅ `Result<T, AppError>` pattern, no-throw across boundaries
- ✅ SQLite setup: WAL + FK ON + migration với `PRAGMA user_version`
- ✅ i18n 6 ngôn ngữ + category translation
- ✅ Currency-aware helpers (`centsToDisplay` / `displayToCents`)
- ✅ Wipe pattern: double-confirm + clear store + re-seed
- ✅ Location wrapper cross-platform + null-safe
- ✅ TypeScript strict, EXIT 0
- ✅ Logger PII scrub
- ✅ Zod validation cho all writes
- ✅ Period summary với click-filter (Today/Week/Month/All)
- ✅ Theme system (light/dark + brand)

---

## Scores

| Tiêu chí | Score |
|---|---|
| Architecture | 8/10 |
| Code quality | 7/10 |
| UX hoàn chỉnh | 4/10 |
| Security | 5/10 |
| Reliability | 3/10 |
| **Production-ready** | **3/10** |

---

## Sprint plan đề xuất

**Sprint 1 ✅ COMPLETE (2026-05-18) — Closed beta prep:**
1. ✅ B4 — Edit transaction
2. ✅ B3 + H6, H7 — ConfirmEntrySheet + Smart Entry date parser
3. ✅ H11 + M27 — Error Boundary + Sentry wire
4. ✅ H10, H15 — Pagination + transaction tap-to-edit
5. ✅ H8, H9, H13, H14 — Locale formatters + hardcoded VN strings + API key gates

**Sprint 2 (2-3 tuần) — Beta launch:** ← CURRENT
1. B1 — Auth (Supabase email/OAuth)
2. B2 — Sync engine (sync_queue + Supabase mirror)
3. B5 — Tests cho service + DB layer (target 70%)
4. M22, M23 — Accessibility audit

**Sprint 3 — Public launch prep:**
1. M16 — Category management UI
2. M17 — Budget feature
3. M20, M21 — Export + backup
4. Public launch checklist
