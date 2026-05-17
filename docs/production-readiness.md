# Production Readiness — Finance Module

> Tracking checklist for moving Finance from MVP → production. Tick boxes as items are fixed. Audit date: 2026-05-18.

**Current state:** 🟢 MVP cá nhân dùng được · 🔴 chưa thể public launch.

| Tier | Definition | Status |
|---|---|---|
| MVP cá nhân | Dùng riêng cho mình | ✅ ready |
| Beta closed | 10–50 friends/family | ❌ cần fix BLOCKER 3, 4, 5 + HIGH 6–9, 11, 14 |
| Public launch | Open user base | ❌ cần thêm BLOCKER 1, 2 + tất cả HIGH + ≥50% MEDIUM |

---

## ❌ BLOCKER

- [ ] **B1. Không có auth** 🔁 cross-module · `docs/security.md#authentication` — `user_id: null` mọi nơi → multi-user impossible, RLS Supabase vô nghĩa
- [ ] **B2. Không có cloud sync** 🔁 cross-module (Rule 1) · `docs/sync-offline.md` — `sync_queue` table chưa tồn tại, Supabase chưa wire → mất phone = mất sạch data
- [x] **B3. Rule 5 (ConfirmEntrySheet) — DONE 2026-05-18** — `<ConfirmEntrySheet>` + `aiAutoConfirm` setting wired vào Smart Entry. Edit/Save/Cancel buttons, echo raw input, parsed summary
- [x] **B4. Edit transaction — DONE 2026-05-18** — Generalized as Rule 7 (CRUD completeness) in CLAUDE.md + architecture.md
- [ ] **B5. Không có tests** 🔁 cross-module · `docs/ops.md#testing` — 0% coverage → refactor là gambling. Coverage gate 70%/90% spec'd

---

## ⚠️ HIGH

- [ ] **H6. Smart Entry matching yếu** 🔁 cross-module (Rule 3) — nếu AI trả tên VN thay vì EN seed, match silent fail → category không set
  - Vị trí: `features/finance/screens/QuickAddScreen.tsx:73`
- [ ] **H7. Date parser cho Smart Entry chưa làm** 🔁 cross-module (Rule 4) · `services/dateParser.ts` (chưa có)
- [x] **H8. Locale-aware DateRow — DONE 2026-05-18** — `services/locale.ts` thêm `getDateFnsLocale()`. DateRow + ReportsScreen + QuickAddScreen confirm sheet đều dùng locale từ `settingsStore.language`
- [x] **H9. Locale-aware formatAmount — DONE 2026-05-18** — `services/locale.ts` thêm `getIntlLocale()`. `formatAmount(cents, currency, language)` + AmountText pass language. JPY/KRW thêm fractionDigits handling. `fmtAI()` cũng fix toLocaleString
- [ ] **H10. Không có pagination** 🔁 cross-module · `docs/database.md#pagination` — default limit=100, UI fetch hết. >100 tx silent truncate
- [x] **H11. Error Boundary spec'd** 🔁 cross-module (Rule 8) · `docs/architecture.md#rule-8` — chưa implement nhưng đã có quy chuẩn
- [ ] **H12. Web SQLite không persist với Firefox** 🔁 cross-module · `docs/database.md#web-fallback` — đã document banner advice
- [ ] **H13. Smart Entry button hiện cả khi không có API key** 🔁 cross-module · `docs/ai-integration.md#feature-gating`
- [ ] **H14. AISettings còn hardcoded VN string** 🔁 cross-module (Rule 2) — Vị trí: `features/settings/screens/AISettingsScreen.tsx:72-93`
- [x] **H15. Tap row transaction = no action** 🔁 cross-module (Rule 7) · DONE 2026-05-18 — tap mở edit, applies to all modules

---

## 🟡 MEDIUM

- [ ] **M16.** Không có category management — finance-specific
- [ ] **M17.** Không có budget/limits per category — finance-specific
- [ ] **M18.** Reports/Insights screens fail silent khi không có API key 🔁 cross-module · `docs/ai-integration.md#feature-gating`
- [ ] **M19.** Duplicate detection có thể false positive — finance-specific
- [ ] **M20.** Không có data export (GDPR) 🔁 cross-module (Rule 1 extended) · `exportAllData()` per module
- [ ] **M21.** Không có backup/restore 🔁 cross-module · liên quan auth + sync
- [ ] **M22.** Không có accessibility labels 🔁 cross-module · `docs/design-system.md#accessibility`
- [ ] **M23.** Mood selector emoji thiếu `accessibilityLabel` — finance-specific áp dụng M22
- [ ] **M24.** API key không validate 🔁 cross-module · `docs/ai-integration.md#api-key-validation`
- [ ] **M25.** `AmountText` color override conflict — finance-specific
- [ ] **M26.** Không có loading state nhiều chỗ 🔁 cross-module · `docs/design-system.md#loading-empty-error-states`
- [ ] **M27.** Sentry/PostHog chưa wire 🔁 cross-module (Rule 8) · `docs/architecture.md#rule-8`
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

**Sprint 1 (2-3 tuần) — Closed beta prep:**
1. B4 — Edit transaction
2. B3 + H6, H7 — ConfirmEntrySheet + Smart Entry date parser
3. H11 — Error Boundary + Sentry wire (M27)
4. H10, H15 — Pagination + transaction detail view
5. H8, H9, H14 — Fix hardcoded locale + VN strings

**Sprint 2 (2-3 tuần) — Beta launch:**
1. B1 — Auth (Supabase email/OAuth)
2. B2 — Sync engine (sync_queue + Supabase mirror)
3. B5 — Tests cho service + DB layer (target 70%)
4. M22, M23 — Accessibility audit

**Sprint 3 — Public launch prep:**
1. M16 — Category management UI
2. M17 — Budget feature
3. M20, M21 — Export + backup
4. Public launch checklist
