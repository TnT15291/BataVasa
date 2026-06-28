# BataVasa — UI/UX & Logic Review

> Rà soát toàn bộ diff nhánh `New-UI` (~50 file) bằng skill `ui-ux-pro-max`.
> Ngày: 2026-06-24 · Nhánh: `New-UI` · Phạm vi: lỗi logic / chưa đẹp, tập trung kỹ **màn hình chính** (Daily Digest).
> Trạng thái: **chỉ báo cáo + đề xuất, chưa sửa/xoá file nào.** Đường dẫn file tính từ thư mục gốc repo.

## Đánh giá chung

Codebase **chất lượng cao và nhất quán**, đặc biệt:
- **Tầng AI** tuân thủ tốt CLAUDE Rule "Rules before AI" (toán deterministic, AI chỉ giải thích), i18n trong prompt, privacy `hideJournals`.
- **Các form** đạt Rule 7 (1 screen create+edit), `ConfirmEntrySheet`, touch target chuẩn (≥44px), `accessibilityState`.

Phần lớn vấn đề **không phải "vỡ"** mà là **nhất quán/đồng bộ** và **chi tiết hoàn thiện**. Có **1 lỗi đúng-sai thực sự** (múi giờ habit) và vài lỗi đồng bộ ảnh hưởng diện rộng (contrast dark mode, safe-to-spend 3 phiên bản, thiếu key i18n).

---

## Bảng ưu tiên

### 🔴 CAO — lỗi đúng/sai hoặc ảnh hưởng diện rộng

| # | Vấn đề | File |
|---|---|---|
| H1 | ✅ **ĐÃ SỬA (2026-06-24)** — Streak / strength / getLogForDate sai múi giờ. Bỏ 3 query `substr`-UTC, thêm `listLogRowsInRange` (so theo mốc ISO) + bucket ngày-local ở tầng service (`localDayBoundsIso`/`bucketLogsByLocalDate`). Sửa thêm `goalProgress`, `habitInsight`, heatmap `HabitsReportScreen`. Thêm test regression TZ. `tsc` sạch, 45 suites/561 test pass. | `database/habits/queries.ts`, `features/habits/services.ts`, `services/ai/habitInsight.ts`, `services/goalProgress.ts`, `features/habits/screens/HabitsReportScreen.tsx` |
| H2 | ✅ **ĐÃ SỬA + QUÉT NỐT (2026-06-24)** — Thêm token `theme.brand.onPrimary` cho cả 5 theme (`themes.ts`); `Button.tsx` primary dùng `onPrimary` (phủ mọi `<Button>`). Thay `#fff`→`onPrimary` ở **mọi bề mặt nền brand đã rà**: 7 FAB (Home/Habits/Journals/Transactions/Debt/Category/Reminders), Universal Add, Onboarding, 4 nút insight + Finance Reports/Analysis, Habit/Journal/Debt/Category/Reminder form (save/smart), Settings (day-chip + modal), AIMemory, Appearance (mode), Auth/UpdatePassword/reset-password CTA, Assistant + QuickBataVasa (bubble + send), shared: `Button`, `VoiceButton`, `SmartEntryCard`, `ConfirmEntrySheet`, `QuickActionRow`, `DateRow`, `InlineDateField`, `ErrorBoundary`, `BiometricLockScreen`. `tsc` sạch, 45 suites/562 test pass. **Cố ý giữ nguyên** các `#fff` trên **màu module/semantic** (FAB Goals/PlanItem/GoalCoach trên analysis-indigo; calendar trên tasks-teal; trash trên danger; swatch ring; Switch thumb) — đó là vấn đề "icon trắng trên màu module sáng" riêng (M-level), không phải lỗi brand dark-mode. | `design/themes.ts`, `components/ui/Button.tsx` + ~25 file |
| H1b | ✅ **ĐÃ SỬA (kèm H1)** — `getHabitStreak` coi ngày **skip** là đứt streak (nghịch spec "skip không phá streak"); `getHabit30DayScore` tính ngày skip vào mẫu số. Nay skip = trung tính (bridge streak, loại khỏi completion-rate), khớp `habitInsight`. Thêm test. | `features/habits/services.ts` |
| H3 | ✅ **ĐÃ SỬA (2026-06-24)** — Safe-to-spend tính 3 cách khác nhau. Nay **1 nguồn duy nhất** `calculateSafeToSpend`: AnalysisScreen Highlights truyền thêm `planItems`; `crossModuleInsight` bỏ `calculatePromptSafeToSpend` (naive income−expense), dùng `calculateSafeToSpend` thật (cycle/plan/savings, settings đọc từ store) + nhận `planItems`/`debts`. Home/Finance vốn đã dùng hàm này → cả 4 bề mặt khớp số. `tsc` sạch, 562 test pass. | `features/analysis/screens/AnalysisScreen.tsx`, `services/ai/crossModuleInsight.ts` |
| ~~H4~~ | ❌ **FALSE POSITIVE (2026-06-24)** — Tưởng `ko.ts` thiếu `reminder_past`/`reminder_next7days`, nhưng đó là lỗi cách đếm key (parity check đếm theo đầu dòng, còn `ko.ts` gói 2 key/dòng). Kiểm lại bằng trích key thật: **cả 6 ngôn ngữ đều đúng 853 key, không thiếu/thừa**. Không cần sửa. | — |
| H5 | ✅ **ĐÃ SỬA (2026-06-24)** — Màn hình chính. (1) Review Queue giờ render **lý do + số đếm** thật (`subtitleKey`→`t.review_item_*` + `count`), hết cảnh "Tài chính/Tài chính"; journal vẫn ẩn khi bật privacy. (2) Day-rhythm bỏ giờ giả 7h: dùng **log time thật**, **chỉ habit đã hoàn thành** (non-skipped) — khớp AllTimelineScreen. `tsc` sạch, 562 test pass. | `features/home/screens/DailyDigestScreen.tsx`, `features/home/hooks/useDailyDigest.ts` |
| H6 | ✅ **ĐÃ SỬA (2026-06-24)** — Bọc `const range = useMemo(() => getRange(), [getRange])` → `range.from/to` giữ identity ổn định, các memo `rangeTxs`/`summary`/`chartBuckets`/`breakdown` chỉ tính lại khi kỳ/ngày đổi (trước đây tính lại mỗi render). `tsc` sạch, 562 test pass. | `features/finance/screens/ReportsScreen.tsx` |

### 🟠 TRUNG

| # | Vấn đề | File |
|---|---|---|
| M1 | ✅ **ĐÃ SỬA (2026-06-24)** — Copy "API key" lỗi thời. Thống nhất gating bằng `isAiAvailable()` ở **14 màn**; đổi copy `no_api_key`/`no_api_key_msg` → "AI tạm thời không khả dụng / thử lại sau" (6 ngôn ngữ); bỏ nút "go to settings" cho key ở Analysis/Weekly/Assistant; repoint EmptyState (Reports/Insights/QuickAdd) sang copy mới. **Gỡ hẳn** `getProviderKey` (shim) + `aiProvider` (store/setter/load + body request — Edge Function `resolveProvider` bỏ qua `clientProvider` nên an toàn). Catch `NO_API_KEY`→`NO_BACKEND`. `tsc` sạch, 562 test pass. | `services/ai/openai.ts`, `store/settingsStore.ts` + 14 màn + 6 i18n |
| M2 | ✅ **ĐÃ SỬA (2026-06-25)** — `setLanguage` không còn ghi đè tiền tệ khi user đã chọn. Thêm cờ `currencyExplicit` (persist `currency_explicit`): bật khi gọi `setCurrency`/`setDisplayCurrency`; `setLanguage` chỉ seed currency theo ngôn ngữ **khi cờ tắt** (first-run/onboarding) — vẫn lưu ngôn ngữ trong mọi trường hợp. `loadSettings` **suy ra explicit** cho user cũ (currency ≠ default ngôn ngữ, hoặc displayCurrency ≠ currency) để không bị clobber dù 1 lần. Thêm 2 test regression. `tsc` sạch, 45 suites/564 test pass. | `store/settingsStore.ts`, `__tests__/settings.store.test.ts` |
| M3 | ✅ **ĐÃ SỬA (2026-06-25)** — (1) Report dùng chung `MOOD_EMOJI_BY_SCORE` (`@design/moods`) thay mảng cục bộ lệch (mood 1 `😢`/4 `😊` khác Form) → Form↔Report khớp mặt. (2) `createJournal` lưu `mood ?? null` (không còn ép `3`=neutral) → "no mood" không lọt vào avg mood (Report đã lọc `mood != null`). Gỡ 2 const chết `MOODS`/`MOOD_EMOJIS` trong Form (vốn dùng bộ 😢/😊 lệch). `tsc` sạch, 45 suites/564 test pass. | `features/journals/screens/JournalsReportScreen.tsx`, `features/journals/services.ts`, `features/journals/screens/JournalFormScreen.tsx` |
| M4 | ✅ **ĐÃ SỬA (2026-06-25)** — (1) Màu: `color = habit.color || accent || …` (trước `accent` đứng đầu → mọi hàng nuốt màu nhóm) → mỗi thói quen hiện đúng màu user chọn, dot/badge nhóm vẫn giữ màu accent. (2) Icon: render **thẳng emoji** (`<Text>{habit.icon}</Text>`) thay vì map qua bộ 11 Feather (mất emoji ngoài map → `check-circle`). Icon luôn là emoji (preset form / default `✅` / UniversalAdd), nên gỡ hẳn `habitIconName`+`IconName`; tận dụng style `rowEmoji` vốn để sẵn. `tsc` sạch, test pass. | `features/habits/screens/HabitListScreen.tsx` |
| M5 | ✅ **ĐÃ SỬA (2026-06-25)** — Viết lại `SkeletonDailyDigest` khớp layout thật trên màn chính: thêm **safe-area top** (`insets.top + spacing[2]`) + `paddingHorizontal spacing[4]` + `gap spacing[2]` (trước dùng `padding:16/gap:12` cứng, thiếu inset → đẩy nội dung lên), bỏ bố cục "avatar 64 + 3 chip + timeline" không có thật. Nay mô phỏng đúng thứ tự **AppHeader → story card → hero card → focus section**, dùng chung token `spacing`/`radius` + `hairlineWidth` như screen → hết giật khi load xong. `tsc` sạch. | `components/SkeletonBox.tsx` |
| M6 | ✅ **ĐÃ SỬA (2026-06-25)** — Thống nhất default-color habit về canonical `MODULE_COLORS.habits` (`#28B985`, đúng preset đầu của form + UniversalAdd). `types.ts` (Zod default — nhánh thật sự chạy mỗi lần tạo) nay `.default(MODULE_COLORS.habits)` (import constant → hết drift). Schema SQL đổi literal `#4CAF50`→`#28B985` + comment "keep in sync" (chỉ dùng khi insert thiếu color, mà Zod luôn cấp sẵn). `tsc` sạch, 64 test habit pass. | `database/habits/schema.ts`, `features/habits/types.ts` |
| M7 | ✅ **ĐÃ SỬA (2026-06-25)** — Thêm `t` vào dep array của `recurringCandidates` useMemo (dùng `translateCategoryName(category, t)` + `t.category_others`) → title/categoryName dịch lại khi đổi ngôn ngữ. `tsc` sạch. | `features/finance/screens/TransactionListScreen.tsx` |
| M8 | ✅ **ĐÃ SỬA (2026-06-25)** — Thêm `getItemType={(item) => item.type}` cho FlashList danh sách giao dịch → tách recycle pool `header` vs `tx`, hết tái dựng layout chéo loại. **Lưu ý:** dự án dùng `@shopify/flash-list@2.0.2` (v2) — `estimatedItemSize` đã **bị gỡ** ở v2 (tự đo kích thước, không còn cảnh báo và không còn trong type), nên ghi chú M8 gốc (theo v1) không áp dụng; tối ưu đúng cho v2 là `getItemType`. `tsc` sạch. (`DebtListScreen` đồng nhất 1 loại item → không cần.) | `features/finance/screens/TransactionListScreen.tsx` |
| M9 | ✅ **ĐÃ SỬA (2026-06-25)** — Chốt lại luật tokens cho khớp thực tế thay vì viết lại ~15 screen. Toàn bộ 8 chỗ `uppercase` + phần lớn `800` là **một** pattern cố ý: "eyebrow/overline" (11px, letter-spaced, all-caps) + nhấn hero-metric. Nay: thêm `weight.extrabold:'800'` + preset `textStyles.eyebrow` (nguồn duy nhất cho all-caps), viết lại comment cho đúng (body floor 12/max 700/no-uppercase; eyebrow là ngoại lệ duy nhất, 800 dành cho eyebrow + hero metric). Đưa 2 eyebrow canonical của DailyDigest (`storyLabel`/`heroLabel`) về preset (giá trị y hệt) để preset không còn chết. `tsc` sạch. **Còn lại:** các screen khác vẫn inline eyebrow giống hệt — có thể migrate dần về `textStyles.eyebrow`, không gấp. | `design/tokens.ts`, `features/home/screens/DailyDigestScreen.tsx` |
| M10 | ✅ **ĐÃ SỬA (2026-06-25)** — Bỏ N+1 hydrate. Trước: `hydrateStats` chạy 4 service-call (≈5 query) **mỗi** thói quen → load list = 1 + 5·N query; mỗi toggle/skip cũng 5 query. Nay: thêm `computeHabitStats(habit, rows, now)` **thuần** (không DB) tính cả 5 stat từ log đã fetch sẵn; `loadHabitsWithStats()` fetch **1 query** `listLogsSince` cho toàn bộ thói quen rồi group in-memory (5·N→1); `getHabitStats(habit)` cho refresh 1 thói quen (5→1). Tách phần streak/30-ngày phức tạp thành pure helper **dùng chung** với `getHabitStreak`/`getHabit30DayScore` cũ → không drift, 64 test H1 cũ vẫn pass. Thêm 4 test (computeHabitStats khớp per-habit + loadHabitsWithStats chỉ 1 query, không fan-out). `tsc` sạch, 45 suites/568 test pass. | `store/habitsStore.ts`, `features/habits/services.ts`, `__tests__/habits.service.test.ts` |

### 🟡 THẤP

**✅ ĐÃ XỬ LÝ HẾT (2026-06-25):**
- ✅ `relShort` có hướng (`+2h` tương lai vs `2h` quá khứ) — `at` có thể là `remind_at` tương lai nên abs làm lẫn "due in 2h" ↔ "2h overdue".
- ✅ IIFE trong `.map()` (HabitList `renderGroup` → block body).
- ✅ `wipeHabits` 2 DELETE gói trong `withTransactionAsync` (+ test mock `withTransactionAsync`).
- ✅ Settings ghi DB qua `persist()` try/catch + log (29 setter) — không còn unhandled rejection nếu storage lỗi.
- ✅ Ký hiệu tiền tệ thật trong prompt AI: `€ £ ¥ CN¥ ₩ ฿` thay mã chữ (`aiLanguage.ts`, + test).
- ✅ `getLogForDate ORDER BY` — moot, H1 đã gỡ hàm này.
- ✅ FAB viền `#fff` → `theme.bg.elevated` (5 list screen: Transactions/Habits/Journals/Reminders/Goals; chuyển sang inline để lấy theme). CategoryForm `colorDotSelected #fff` **cố ý giữ** (swatch ring, đã chốt ở H2).
- ✅ Search hết rò tiếng Anh: cadence (`localizeCadence`) + tags (`localizeTags`) dịch lúc hiển thị (Rule 2 — canonical English trong DB, dịch ở display).
- ✅ A11y picker chỉ-báo-bằng-màu: HabitForm (icon/màu/cadence/weekday), CategoryForm (màu), OnboardingModal (ngôn ngữ) — thêm `accessibilityRole="button"` + `accessibilityState={{ selected }}` (+ `accessibilityLabel` cho ô màu/ngôn ngữ).
- ✅ Empty-state TransactionList (review/search/default) → `EmptyState` dùng chung, gỡ 5 style chết. **Cố ý giữ** empty viết tay của HabitList (có sample chips + CTA, phong phú hơn `EmptyState`).

`tsc` sạch, 45 suites/568 test pass.

---

## Chi tiết theo file

### Màn hình chính (trọng tâm)

#### `features/home/screens/DailyDigestScreen.tsx`
- ❌ **Review Queue vứt dữ liệu đã tính.** Hàng chỉ dùng `title` + `moduleLabel`; bỏ `item.subtitleKey`/`count`/`progressText`. Khi `title` rỗng → hiển thị **"Tài chính / Tài chính"**; mất lý do ("Cần xem lại/Quá hạn") và số đếm. → Map `subtitleKey` sang `t.*`, nối `count` vào meta.
- ❌ **Habit trên Day-rhythm là giờ giả** (7h + index×10') và **gồm cả habit chưa làm** → "hình dạng ngày" sai bản chất. → Chỉ vẽ habit đã xong, dùng `occurred_at` thật (AllTimelineScreen đã làm đúng).
- ⚠️ `reviewCount` (badge) đếm **nhóm** (≤5) chứ không phải số item.
- ⚠️ `relShort` dùng `Math.abs` → mất hướng ("2h" cho cả quá hạn lẫn sắp tới).
- ⚠️ 3 Quick Action cùng màu `analysis` → không phân biệt thị giác.
- ⚠️ `now` tạo mới mỗi render (hook đã cố tình đóng băng `nowTs`).
- 💡 Hero "Safe to spend" hiện "0 trong N ngày" cho user mới → nên CTA thiết lập ngân sách.

#### `features/home/hooks/useDailyDigest.ts`
- ❌ `timelineItems.slice(0,8)` lấy 8 sự kiện **sớm nhất** → sự kiện buổi tối bị loại khỏi Day-rhythm.
- ❌ `recentLogs` refetch theo `habits.length` → `worstHabitMissed` cũ sau khi toggle.
- ⚠️ `openTaskTitles` dedupe theo *title* nhưng `dueTaskCount` dedupe theo *id* → lệch khi trùng tên.
- ⚠️ `habitsDoneCount`/`nextHabit`/`pendingHabitNames` không memo (lệch kỷ luật của hook).

#### `components/ui/SignalsTimeline.tsx`
- ⚠️ Marks vô hình với screen reader (chỉ đọc tên module, không số/giờ sự kiện).
- ⚠️ `nowPill marginLeft:-20` cố định → lệch tâm / tràn mép trái ở 6h sáng.
- ⚠️ Chấm trùng giờ chồng lên nhau, không gộp.

#### Primitives & nền tảng
- `AppHeader.tsx` ✅ (subtitle "AI Personal OS" hardcode — chấp nhận vì là tagline).
- `ListRow.tsx` ⚠️ subtitle `numberOfLines={2}` → hàng có thể cao 4 dòng, phá nhịp 52px.
- `SectionHeader.tsx` ⚠️ touch target action thấp (<44px).
- `QuickActionRow.tsx` ✅ (label màu module trên nền tint 10% — cần kiểm contrast màu sáng).
- `Chip.tsx` ⚠️ prop `color` chỉ áp vào icon, không áp text.
- `StatusPill.tsx` ⚠️ tone `neutral` dùng muted làm cả bg lẫn text → contrast thấp.
- `IconBadge.tsx`/`BrandMark.tsx`/`ScreenTransition.tsx`/`SkeletonBox.tsx` ✅ (~~`SkeletonDailyDigest` lệch layout~~ — M5 ✅ đã khớp layout thật).
- `design/tokens.ts` ⚠️ Dark `brand.primary = #88B8B1` (H2). ~~luật weight/uppercase tự mâu thuẫn~~ (M9 ✅ — `extrabold` + preset `eyebrow`, comment đã đúng).
- `design/moduleColors.ts` ✅ hex 6 số hợp lệ; ⚠️ icon trắng trên màu sáng (journal amber, habits green) contrast thấp.

#### `features/home/components/OnboardingModal.tsx`
- ❌ A11y: nút ngôn ngữ chỉ báo chọn bằng màu, thiếu `accessibilityRole`/`accessibilityState`.
- ⚠️ Nút Continue dính lỗi contrast dark (H2).

#### `features/home/components/UniversalAddSheet.tsx`
- ⚠️ Cổng `getProviderKey` + alert `api_key_required` (M1) — nay là shim nên không chết, nhưng copy sai.
- ⚠️ Lưu nhiều candidate không nguyên tử (lỗi giữa chừng để lại row đã lưu, không rollback).
- ⚠️ Màu cứng `#D97706` cho dòng "còn thiếu" thay vì `theme.semantic.warning`.
- ✅ Rất tốt: touch target chuẩn, card `accessibilityRole="checkbox"`, voice luôn confirm, gesture mượt.

#### `features/home/screens/AllTimelineScreen.tsx`
- ⚠️ Không có empty state; mất số tiền giao dịch; không bọc `ScreenTransition`.
- 💡 Là nơi habit dùng `log.occurred_at` thật → đối chứng cho H5.

### Finance

- **`TransactionRow.tsx`** ⚠️ icon trắng trên `category.color` (user-pick có thể sáng). ✅ a11y label+hint, xử lý mismatch, review pill.
- **`finance/i18n.ts`** ⚠️ `matchCategory` fallback substring dễ khớp nhầm hint ngắn ("Other" ⊂ "Other Income"). ✅ exact-match trước.
- **`services/ai/financeFormat.ts`** ✅ sạch, đúng (seed weekday UTC).
- **`TransactionListScreen.tsx`** ~~❌ `recurringCandidates` thiếu dep `t`~~ (M7 ✅). ⚠️ ~~FlashList thiếu `estimatedItemSize`~~ (M8 ✅ — thêm `getItemType`; v2 không dùng `estimatedItemSize`); FAB viền `#fff`; phân trang chỉ khi `activePeriod==='all'` → tháng/tuần có thể thiếu tx cũ; empty viết tay; header rất nặng. ✅ undo xoá (tx/plan/debt), touch target chuẩn, settled-plan UX.
- **`ReportsScreen.tsx`** ❌ `range` không memo (H6). ⚠️ copy API key; không safe-area top; `#fff` trên brand; tabs/filter thiếu a11y. ✅ donut đúng (full-circle, gradient id sanitize), delta đúng, EmptyState.

### Habits

- **`database/habits/queries.ts`** ❌ **H1** — `countLogsForDate`/`getLogForDate`/`listLogCountsByDate` dùng `substr` ngày UTC; `getLogForDate LIMIT 1` không ORDER BY; `wipeHabits` 2 DELETE không transaction.
- **`features/habits/services.ts`** ❌ `getHabitStreak`/`getHabit30DayScore` duyệt ngày local nhưng tra map keyed bằng ngày UTC (H1). ✅ Result-based, Zod, soft-delete+restore, `buildImplementationIntention`.
- **`habitInsight.ts`** ❌ lặp lại H1 (`occurred_at.split('T')[0]` vs `localDateStr`). ✅ rules-before-AI, identity framing.
- **`HabitListScreen.tsx`** ~~❌ màu nhóm đè màu thói quen + mất emoji icon~~ (M4 ✅ — `habit.color` ưu tiên + render emoji thẳng); ⚠️ `#fff`/FAB; empty viết tay. ✅ "never miss twice", milestone, undo.
- **`HabitFormScreen.tsx`** ❌ a11y ô màu/cadence (chỉ màu). ⚠️ copy API key; `#fff` trên brand. ✅ Rule 7, ConfirmEntrySheet, impl-intention preview, picker iOS/Android.
- **`types.ts`/`schema.ts`/`habitsStore.ts`** ~~⚠️ 3 default-color lệch (M6)~~ (M6 ✅ — về `MODULE_COLORS.habits`); ~~N+1 hydrate (M10)~~ (M10 ✅ — batched 1 query).

### Journals

- **`services.ts`** ~~⚠️ `mood ?? 3` → "no mood" thành neutral~~ (M3 ✅ — nay `?? null`). ✅ export tôn trọng hideJournals.
- **`JournalListScreen.tsx`** ⚠️ empty không header; moodBadge icon trắng trên màu mood; FAB `#fff`; IIFE. ✅ nhóm theo ngày, lock privacy, undo, star, tag chips.
- **`JournalsInsightsScreen.tsx`** ⚠️ copy API key; `#fff` brand. ✅ chặn hideJournals, guard ≥3, Sparkle, layout rõ.
- **`JournalFormScreen.tsx`** ⚠️ copy API key; `#fff`; ~~const `MOODS`/`MOOD_EMOJIS` chết~~ (M3 ✅ — đã gỡ). ✅ **rất tốt** — Rule 7, lock-screen sửa journal ẩn, templates, anniversary reminder, mood/tags/important đều `accessibilityRole="checkbox"`.
- **`JournalsReportScreen.tsx`** ~~❌ `MOOD_EMOJI` lệch Form~~ (M3 ✅ — dùng chung `MOOD_EMOJI_BY_SCORE`). ⚠️ `getRange()` gọi 2 lần/render; không safe-area top. ✅ delta đúng, hideJournals, phân bố mood, EmptyState.

### Analysis / Assistant / Settings

- **`AnalysisScreen.tsx`** ❌ `calculateSafeToSpend` thiếu `planItems` → lệch số với Home/Finance (H3). ⚠️ copy API key; `#fff`. ✅ statusScrim, loại income-cat khỏi top-spend, so MTD.
- **`WeeklyLifeReviewScreen.tsx`** ⚠️ weight 800 + uppercase nghịch tokens; copy API key. ✅ **rất tốt** — snapshot deterministic, gộp lane "no data", xử lý "expense=0 → —".
- **`store/settingsStore.ts`** ~~❌ `setLanguage` ghi đè currency~~ (M2 ✅ — cờ `currencyExplicit`). ⚠️ setter ghi DB không try/catch. ✅ defaults hợp lý.
- **`SettingsScreen.tsx`** ⚠️ `Switch` hardcode màu; day-chip `#fff` trên brand. ✅ **rất tốt** — phân nhóm + disclosure, master sync + per-module (Rule 1), biometric/password gate, touch target chuẩn.

### AI services

| File | Kết luận |
|---|---|
| `aiLanguage.ts` | ✅ định dạng chuẩn. ⚠️ EUR/GBP/JPY hiện mã chữ thay ký hiệu. |
| `userContextPrompt.ts` | ✅ **rất tốt** — scoring domain (VN+EN), pinned, bounded, cache tách DB. |
| `habitInsight.ts` | ✅ rules-before-AI. ❌ lặp lỗi múi giờ H1. |
| `financeInsight.ts` | ✅ tóm tắt deterministic giàu, loại debt, localized weekday. |
| `journalInsight.ts` / `reminderInsight.ts` | ✅ sạch, guard, JSON extraction, hideJournals. |
| `assistantContext.ts` | ✅ **xuất sắc** — tách savings vs regular, goal-source labeling. |
| `longTermContext.ts` | ✅ rollup SQL deterministic, best-effort. (strftime năm UTC — sai số biên không đáng kể.) |
| `goalCoach.ts` | ✅ **xuất sắc** — không tin ngày AI, clamp, dedupe habit, output gated theo module. |
| `weeklyLifeReview.ts` | ✅ **xuất sắc** — snapshot deterministic, loại debt/income, delta null-guard. |
| `crossModuleInsight.ts` | ✅ khối tương quan mạnh, "correlation ≠ causation". ⚠️ chứa safe-to-spend thứ 3 (H3). |
| `reports.ts` | ✅ tách income/expense, loại debt, section theo loại report. |

### Core / DB / search / i18n / SQL

- **`database/core/migrate.ts`** ✅ migration tăng dần idempotent, reuse promise, `PRAGMA user_version`. ⚠️ không transaction/migration (an toàn nhờ `IF NOT EXISTS`); doc ghi v23 nhưng code v24.
- **`services/search.ts`** ✅ tìm song song, privacy hideJournals, min 2 ký tự. ⚠️ rò tiếng Anh (cadence/tags); sort trộn `occurred_at`/`updated_at`.
- **`services/i18n/translations/*`** ✅ **Đủ key** — kiểm lại bằng trích key thật: cả 6 ngôn ngữ đúng **853 key**, không thiếu/thừa. (Cảnh báo "ko.ts thiếu 2 key" trước đó là FALSE POSITIVE do `ko.ts` gói 2 key/dòng, parity check đếm theo đầu dòng nên hụt.)
- **`docs/supabase-setup.sql`** ✅ mọi bảng bật RLS + policy, cột khớp schema local.
- **`__tests__/*` (9 file)** ✅ cập nhật kèm tính năng. Khuyến nghị thêm test múi giờ cho khối habit.

---

## Đề xuất phương án sửa & nâng cấp (theo PR nhỏ)

1. **PR `habit-timezone` (🔴 H1)** — chuẩn hoá so sánh theo ngày: dùng ISO range (như `countLogsInRange`) hoặc thêm cột `local_date`; bỏ mọi `substr(occurred_at,1,10)` cho so sánh "theo ngày" ở `queries.ts`/`services.ts`/`habitInsight.ts`. Thêm unit test múi giờ (UTC+7, UTC-8).
2. **PR `onPrimary-token` (🔴 H2 + 🟠 M9 ✅)** — thêm `theme.brand.onPrimary` (light `#fff`, dark tối); thay mọi `#fff` cứng trên nền brand (FAB, nút primary, story icon). ~~Chốt lại luật tokens~~ (M9 ✅ — đã thêm `extrabold` + preset `eyebrow`, comment khớp thực tế).
3. ~~**PR `safe-to-spend-unify` (🔴 H3)**~~ — ✅ ĐÃ LÀM (2026-06-24): 1 nguồn `calculateSafeToSpend`; Analysis truyền `planItems`; cross-module bỏ `calculatePromptSafeToSpend`.
4. **PR `home-polish` (🔴 H5 ✅ + 🟠 M5)** — ✅ ĐÃ LÀM: Review Queue render `subtitleKey`/`count`; habit lane dùng log time thật + chỉ habit đã xong. ~~**Còn lại (M5):** skeleton khớp layout~~ (M5 ✅); cân nhắc bỏ `slice(0,8)` cứng của timeline.
5. ~~**PR `managed-ai-cleanup` (🟠 M1)**~~ — ✅ ĐÃ LÀM (2026-06-24): copy "AI tạm thời không khả dụng", thống nhất `isAiAvailable()`, gỡ `aiProvider`/`getProviderKey`. (Còn 2 i18n key chết `api_key_required`/`setup_ai_first` — vô hại, dọn sau.)
6. **PR `small-fixes`** — ~~`ReportsScreen` memo `range` (H6 ✅ đã làm)~~; ~~`setLanguage` không ghi đè currency (M2 ✅)~~; ~~mood emoji về `@design/moods` + cho `mood=null` (M3 ✅)~~; ~~màu nhóm/emoji habit (M4 ✅)~~; ~~default-color thống nhất (M6 ✅)~~; ~~`recurringCandidates` dep `t` (M7 ✅)~~; ~~FlashList `estimatedItemSize` (M8 ✅ — v2 dùng `getItemType`)~~; a11y màu/cadence/ngôn ngữ.

Sau mỗi PR: `npx tsc --noEmit` + `npm test -- --runInBand`.
