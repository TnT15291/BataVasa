# BataVasa — Từ "tracker" thành "trợ lý cuộc sống"

> Góp ý sản phẩm. Ghi lại từ buổi thảo luận. Đây là tài liệu định hướng, **không phải** việc cần làm trước closed beta.

## TL;DR

App **không thiếu module nào nữa** — 4 module (Finance, Reminders, Habits, Journals) + AI + sync + offline-first đã hoàn chỉnh ở mức "personal OS / sổ tay cuộc sống có AI" (~90%).

Thứ làm nó "đầy đủ hơn" **không phải thêm lĩnh vực**, mà là **3 lớp phủ lên dữ liệu đã có**:

1. **Lớp 1 — Vệ sinh cơ bản:** Global Search + Backup/Restore (làm app *đáng tin & dùng được lâu dài*).
2. **Lớp 2 — Bộ não:** Weekly Life Review + Trí nhớ mục tiêu + Proactive (làm app *biết nghĩ*).
3. **Goals module** — "module thứ 5" duy nhất đáng làm: vừa là tính năng, vừa là **cột sống nối 4 module** và **vá mảnh trí nhớ** mà trợ lý đang thiếu.

> ⚠️ **Kỷ luật:** roadmap hiện tại nói việc kế tiếp là **verify (B1/B2) + test (→70%) để ship closed beta**, KHÔNG phải thêm tính năng. Mọi thứ dưới đây là cho *sau* khi qua beta. Thêm một bề mặt chưa test lúc này làm điểm production *giảm*, không tăng.

## Vì sao "chưa phải trợ lý"

Trợ lý thật khác công cụ ghi chép ở 4 điểm: **chủ động · hiểu liên kết · nhớ bạn · giúp bạn hành động.**

| Tiêu chí "trợ lý" | BataVasa hiện tại | Trạng thái |
|---|---|---|
| Ghi nhận đa lĩnh vực (4 module) | Đủ + CRUD + sync | ✅ Xong |
| Phân tích từng mảng (insight/module) | AI insight mỗi module | ✅ Xong |
| **Chủ động** (tự nhắc/cảnh báo/tổng kết) | Gần như chỉ phản ứng (pull-only). M37 chưa làm | ❌ Thiếu |
| **Hiểu liên kết chéo** (tiền↔mood↔thói quen) | Mới ở mức highlight/so sánh. Weekly Review & correlations (M36) chưa làm | 🟡 Một nửa |
| **Trí nhớ về bạn** (mục tiêu, ngữ cảnh dài hạn) | Không có — AI stateless | ❌ Thiếu |
| **Giúp hành động** (insight → đề xuất → 1 chạm) | Chưa có vòng "gợi ý → chấp nhận" | ❌ Thiếu |

**Kết luận:** là "personal OS" ~90%; là "trợ lý cuộc sống" ~50%. Bộ xương (dữ liệu 4 mảng) xong, **bộ não** (liên kết + chủ động + trí nhớ) phần lớn chưa lắp.

---

## LỚP 1 — Vệ sinh cơ bản của "personal OS"

Không phải differentiator, mà là *điều kiện cần* để dữ liệu cuộc sống dùng được.

### 1a. Global Search (M38)

- **Vấn đề:** user *ghi vào* mỗi ngày nhưng gần như không *lấy ra* → dữ liệu thành "nghĩa địa write-only".
- **Lắp vào đâu:** SQLite là nguồn sự thật → thuần một **read-model** trên 4 bảng.
  - `services/search.ts` truy vấn song song `finance_transaction` (merchant/note), `reminder` (title), `habit` (name), `journal` (content) — lọc theo text / khoảng ngày / số tiền.
  - Kết quả gom nhóm theo module; màn `app/search.tsx`; debounce.
  - **AI chỉ là lớp phủ tùy chọn:** câu hỏi tự nhiên → AI dịch thành *filter*, việc đếm/tính vẫn deterministic (đúng pattern `smartEntry`).
- **Độ khó / rủi ro:** trung bình / **rủi ro thấp vì read-only**. Đáng làm sớm nhất.

### 1b. Backup / Restore (M21)

- **Vấn đề:** đây là **niềm tin**, không phải tính năng. Người ta chỉ giao dữ liệu cuộc sống khi tin mất máy vẫn lấy lại được.
- **Đã có sẵn ~80% nền:** sync queue + Supabase (bản sao cloud) + `exportAllData()` mỗi module (Cross-Module Rule 1).
- **Mảnh còn thiếu:**
  - *Khôi phục qua cloud:* đăng nhập máy mới → kéo từ Supabase về SQLite (sync đã làm được, cần làm **rõ ràng + verify** — nằm trong blocker B1/B2).
  - *Backup file thủ công:* gộp export 4 module thành 1 file + đường import ngược (cho user không tin cloud).
- **Lắp vào đâu:** `services/backup.ts` điều phối export/import từng module + màn Settings.
- **Rủi ro:** cao hơn search — import phải lo **trùng id, chống nhân bản, version schema** (đang migration v12). Cẩn thận, nhưng không phải nghiên cứu mới.

---

## LỚP 2 — Bộ não (biến tracker thành trợ lý)

### 2a. Weekly Life Review

- **Là gì:** báo cáo định kỳ hàng tuần ghép **cả 4 mảng + goals** thành một câu chuyện ngắn, thay vì 4 báo cáo rời.
- **Xây trên cái đã có:** `AnalysisScreen` đã có highlights rule-based + so sánh tháng + thẻ "AI Patterns". Đây là phiên bản **tường thuật, nhịp tuần** của nó.
  - Số liệu (chi, ±% vs tuần trước, thói quen hoàn thành, mood TB) → **tính deterministic** (CLAUDE.md cấm AI làm số học).
  - AI **chỉ viết diễn giải + 1–2 gợi ý**.
  - Ví dụ: *"Tuần này tiêu 2,1tr (−12%). Hoàn thành 5/7 thói quen. Đáng chú ý: thứ Tư mood thấp đi kèm chi vọt 400k. Gợi ý: thử ghi nhật ký vào những ngày như vậy."*
- **Đây là khoảnh khắc app "nói như một trợ lý".** Đòn bẩy cao nhất của Lớp 2.

### 2b. Lớp trí nhớ mục tiêu

- **Khoảng trống lớn nhất:** AI **stateless** — mỗi prompt dựng từ dữ liệu gần đây, không nhớ *bạn là ai, đang cố làm gì* (`services/ai/` không có store memory/goal nào).
- **"Trí nhớ" gồm:**
  1. Mục tiêu tường minh (chính là Goals module) — phần có cấu trúc.
  2. Sự thật/sở thích suy ra ("hay tiêu cuối tuần", "coi trọng giấc ngủ").
  3. Ngữ cảnh user tự ghim.
- **Cách làm:** bảng nhỏ `user_context`/`ai_memory`, **nhét vào system prompt mỗi lần gọi AI**. Biến insight chung chung thành có định hướng. Là PII → theo Rule 1 (wipe/export).

### 2c. Proactive (chủ động)

- **Khoảng trống:** app **pull-only** — chỉ phản ứng khi mở.
- **Cách làm:** `expo-task-manager` chạy nền tính tổng kết tuần / phát hiện sự kiện (vượt ngân sách, mood tụt, sắp đứt streak) → `expo-notifications` đẩy → deep-link vào màn liên quan.
- **Phải "calm":** allow-list, giới hạn tần suất, có toggle — chạm vai chứ không cằn nhằn.
- **Rủi ro:** background task iOS hay đỏng đảnh + "notification fatigue". Làm *sau* khi Weekly Review tồn tại.

---

## MODULE GOALS — đi sâu

"5th module đáng làm duy nhất": vừa là tính năng, vừa là **cột sống** nối 4 module + vá mảnh trí nhớ. Là *lớp mục đích* phủ lên dữ liệu sẵn có, **không phải tracker mới**.

### Khái niệm

Một **Goal = một ý định có thể đo + có mốc thời gian, tự kéo tiến độ từ module đã có.**

| Loại goal | Nguồn đo (tự động) |
|---|---|
| Tiết kiệm "50tr trong năm" | Finance — tổng category `kind: savings` |
| Giới hạn "ăn ngoài < 2tr/tháng" | Finance — chi theo category + `monthly_budget_cents` đã có |
| "Gym 4 buổi/tuần" | Habits — completion rate của habit |
| "Viết nhật ký mỗi ngày" | Journals — số entry/tuần |
| "Xong dự án X" | Reminders — % task hoàn thành |
| Định tính ("bớt stress") | Không tự đo → check-in thủ công + liên kết journal |

### Mô hình dữ liệu (theo quy ước hiện có)

Bảng `goal` kiểu giống `finance_*`: `id, user_id, title, description, type, target_value, unit, start_date, due_date, status` + cột sync/soft-delete chuẩn.

**Điểm cốt lõi — "metric binding":** goal mô tả *cách* lấy số từ module nào. Ví dụ `type=savings` → `SUM(abs(amount)) WHERE category.kind='savings' AND occurred_at BETWEEN start AND due`.

→ **Tiến độ là DẪN XUẤT (tính từ dữ liệu module), không nhập tay.** Đây là chìa khóa giữ "low-friction": app tự tính như cách reports đang tính. Cache + tính lại khi dữ liệu đổi.

### Vì sao nó CHÍNH LÀ trí nhớ AI

Bảng `goal` là **ngữ cảnh dài hạn có cấu trúc**. Mỗi lần gọi AI, nhét khối gọn "goals đang hoạt động + tiến độ" vào system prompt:

> Generic: *"Bạn tiêu 3tr cho ăn ngoài."*
> Có goals: *"Bạn tiêu 3tr ăn ngoài — vượt mục tiêu 2tr/tháng, tiền dư lẽ ra vào quỹ 50tr (đang chậm 1 tháng)."*

AI cuối cùng **biết bạn đang cố điều gì** → *ưu tiên được điều đáng nói*. Đây là bước nhảy tracker → trợ lý.

### UX — calm & low-friction

- Màn Goals: vài thẻ với vòng tiến độ. Tap → chi tiết + dữ liệu đóng góp + ghi chú AI.
- Tạo goal: chọn *loại* → app **tự gợi ý binding**, gõ tối thiểu. Có thể tạo qua Universal Add → Rule 5 confirm sheet.
- **Không gamify nặng** (giữ "calm"): nhắc nhẹ trong Weekly Review, không huy hiệu/đua streak dồn dập.

### Tuân thủ Cross-Module Rules (bắt buộc)

Là domain module nên phải đủ: **Rule 1** (sync/export/wipe), **Rule 2** (i18n 6 ngôn ngữ + format locale), **Rule 5** (AI parse → confirm), **Rule 7** (CRUD đủ, 1 màn create/edit chung), **Rule 8** (error boundary + `Result<T>`). Cấu trúc `features/goals/`, `store/goalsStore.ts`, `database/goals/`, `ai/goalInsight.ts`.

### Phân kỳ (để không phình)

- **Phase 1 (MVP):** goal thủ công + tiến độ dẫn xuất cho **2 loại** (tiết kiệm + thói quen) + nhét context vào AI. Giữ tập `type` nhỏ.
- **Phase 2:** thêm binding (giới hạn chi, journal, task), tạo qua Universal Add, nhắc proactive.
- **Rủi ro chính:** lớp "metric binding" dễ phình — kiểm soát bằng cách giới hạn số `type` lúc đầu.

---

## Mối liên hệ & thứ tự đề xuất

- **Lớp 1** làm app *đáng tin & dùng được lâu dài* (tìm ra + không mất).
- **Lớp 2** làm app *biết nghĩ* (tổng kết + nhớ + chủ động).
- **Goals** nối Lớp 2 với 4 module — vừa là dữ liệu để Weekly Review kể chuyện, vừa là trí nhớ để AI có định hướng.

**Thứ tự (sau closed beta):** `Global Search → Goals (MVP) → Weekly Life Review`
— Goals nên có *trước* Review để Review có mục tiêu mà tham chiếu.

## Điều KHÔNG nên thêm (giữ "calm, lightweight")

- ❌ Tracker lĩnh vực rời rạc (sleep/nutrition/fitness riêng lẻ) — giá trị biên thấp, làm app nặng. Nên là *thuộc tính* trong Habits/Journals.
- ❌ Tích hợp calendar/email/bank — phức tạp, lệ thuộc bên thứ 3 (doc đã defer đúng).
- ❌ Social / chia sẻ / gamification — lệch hướng "calm personal OS".
