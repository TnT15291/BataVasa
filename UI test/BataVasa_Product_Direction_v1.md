# BATAVASA — PRODUCT DIRECTION v1

> Tài liệu hướng đi sản phẩm, đủ chi tiết để thực hiện.
> Nguồn: tranh luận trên `BataVasa_full_provision.md` (BATAVASA_PRODUCT_REVIEW_v1) + ràng buộc trong `CLAUDE.md`.
> Trạng thái: **Quyết định nháp v1** — chốt trước khi đưa vào `docs/current-state.md`.

---

## 0. TL;DR (đọc cái này nếu chỉ có 60 giây)

- **Vấn đề với hướng cũ:** doc provision đặt cược vào "Personal Life OS" + Daily Brief + Goal Engine ngay Phase 1. Đó là tầm nhìn 3 năm xuất sắc nhưng là build-plan nguy hiểm: ba thứ khó nhất, phụ thuộc dữ liệu nhất, tần suất thấp nhất bị nhồi cùng lúc.
- **Hướng đúng:** **Thắng tuyệt đối ở Finance trước.** Để **Safe To Spend** (con số mở app mỗi ngày) + **Smart Capture** nuôi cái moat dữ liệu. Mở rộng Habits → Journal → Daily Brief → Goals → AI Coach theo thứ tự phụ thuộc dữ liệu tăng dần.
- **Định vị bán ra:** "App tài chính AI hiểu *hành vi* của bạn." KHÔNG bán "Life OS" ngày đầu — hãy *trở thành* nó.
- **Moat thật:** không phải tính năng (copy được) mà là **dữ liệu cá nhân tích lũy + AI memory + lòng tin.**

---

## 1. Định vị sản phẩm (Positioning)

### 1.1. Một câu
> **"App tài chính AI hiểu hành vi của bạn."**

### 1.2. BataVasa LÀ gì (v1)
- Một app tài chính cá nhân **offline-first** với **AI nhập liệu** và **insight hành vi/cảm xúc chi tiêu**.
- Một con số đáng tin mỗi sáng: **Safe To Spend**.

### 1.3. BataVasa KHÔNG bán gì (giai đoạn đầu)
- Không bán "Personal Life OS" / "second brain" / "life dashboard" — đó là category nghĩa địa, không ai search, không giải thích nổi trong một câu.
- Không bán "chatbot AI".
- "Life OS" là **North Star 3 năm**, không phải tagline launch.

> 🟥 **PHẢN BIỆN (Claude):** Doc gạt bỏ "Life OS" vì là *category nghĩa địa* — đúng. Nhưng "App tài chính AI" lại là một **category đẫm máu, lắm vốn**: Cleo, Copilot Money, Monarch, Rocket Money, Spendee… đều đã bán đúng câu "AI hiểu chi tiêu của bạn". Ta đang đổi một category-không-ai-search lấy một category-quá-nhiều-tay-to. Khác biệt thật (theo chính doc, §0) là **cross-module: emotion↔spending↔habit** — nhưng định vị §1.1 lại giấu hết phần đó đi.
>
> 🟨 **GÓP Ý:** Định vị nên giữ mũi nhọn finance NHƯNG hé lộ wedge ngay câu hai: *"App tài chính AI hiểu hành vi của bạn — vì nó nhìn cả thói quen & cảm xúc, không chỉ con số."* Bán lát cắt finance, nhưng đừng để nó trông giống "Money Lover gắn thêm AI".

### 1.4. Vì sao Finance là mũi nhọn (không phải Daily Brief/Goal)
| Tiêu chí | Finance / Safe To Spend | Daily Brief | Goal Engine |
|---|---|---|---|
| Tần suất kiểm tra tự nhiên | **Hàng ngày** | Hàng ngày (nếu có chất) | Tuần/tháng |
| Phụ thuộc dữ liệu để có giá trị | Thấp (chỉ cần finance) | **Cao** (cross-module) | Trung bình–cao |
| Độ cụ thể / dễ kiểm tra | **Một con số** | Mơ hồ, dễ thành nhiễu | Trừu tượng |
| Khả năng phòng thủ | Cao (dữ liệu tích lũy) | Trung bình | Thấp (user hay bỏ goal) |
| Khớp `CLAUDE.md` | **Finance = primary** | — | — |

→ Finance là thứ duy nhất vừa **tần suất cao** vừa **giá trị-ngay-cả-khi-thiếu-dữ-liệu**. Nó là động cơ nạp dữ liệu cho mọi thứ phía sau.

> 🟥 **PHẢN BIỆN (Claude):** "Phụ thuộc dữ liệu = Thấp" cho Finance **chỉ đúng một nửa**. Finance cần ít *dữ liệu lịch sử*, nhưng:
> - **Phụ thuộc cấu hình CAO:** Safe To Spend (§6.2) cần user khai thu nhập + cam kết cố định + mục tiêu tiết kiệm *trước khi* có con số. Đó là ma sát onboarding lớn — nghịch với chính nguyên tắc "ma sát tối thiểu".
> - **Phụ thuộc capture liên tục CAO:** con số chỉ đúng nếu *mọi* giao dịch được ghi. Sót một lần mua tiền mặt → số sai → mất lòng tin → bỏ app. Đây là **cách chết kinh điển của app tài chính nhập tay**, và doc chưa hề nhắc tới.
>
> 🟨 **GÓP Ý — phải bổ sung vào Bước 1:** (1) Onboarding Safe To Spend cần **đường tắt zero-config** (suy ra từ số dư + vài giao dịch đầu, hỏi chi tiết sau). (2) Cần chiến lược chống-sót-giao-dịch: nhắc cuối ngày "có gì chưa ghi không?", phát hiện khoảng trống, và — quan trọng nhất — **lộ trình bank-sync/import** (ở VN khó, nhưng phải nằm trong tầm nhìn, nếu không thesis Safe To Spend rất mong manh).

---

## 2. Nguyên tắc quyết định duy nhất (dùng để cắt scope)

> **Mọi tính năng phải trả lời được:**
> *"Nó có làm tăng việc capture dữ liệu hàng ngày với ma sát tối thiểu, và giá trị rút ra từ dữ liệu tích lũy không?"*

Nếu không → cắt hoặc hoãn. Lý do: **moat = dữ liệu tích lũy + AI memory + lòng tin.** Lịch sử càng dài → insight càng sâu → chi phí rời bỏ càng cao. Mỗi quyết định phải làm dày cái vòng xoáy đó.

---

## 3. Vòng lặp hàng ngày cốt lõi (Core Daily Loop)

> **Smart Capture (finance-first) → Safe To Spend (con số) → micro-insight hành vi/cảm xúc**

3 bước, vòng lặp chặt, kéo user quay lại mỗi ngày. Mọi màn hình khác là phụ trợ cho vòng lặp này.

```
Mở app
  └─ thấy ngay con số Safe To Spend hôm nay
       └─ chạm Add (✨) → gõ/nói "trưa 50k" → AI parse → xác nhận → lưu
            └─ Safe To Spend cập nhật tức thì
                 └─ 1 micro-insight ("3 ngày liền vượt mức ăn uống")
```

---

## 4. Roadmap theo thứ tự PHỤ THUỘC DỮ LIỆU (đảo trọng tâm so với doc cũ)

> Nguyên tắc sắp xếp: **xây thứ cần ÍT dữ liệu & tần suất CAO trước; thứ cần NHIỀU dữ liệu & lòng tin để sau.**

| Bước | Xây gì | Vì sao đặt ở đây | Điều kiện "xong" (Definition of Done) |
|---|---|---|---|
| **1** | Finance Smart Capture + **Safe To Spend** + insight hành vi/cảm xúc chi tiêu | Mũi nhọn. Con số kéo user về. Phòng thủ được. Cần ít dữ liệu. | Xem §5, §6, §7 |
| **2** | **Habits** | Rẻ để thêm. Tương quan tự nhiên với chi tiêu (ngày thiếu ngủ → tiêu nhiều hơn). | Habit log có occurred_at; tối thiểu 1 tương quan finance↔habit hiển thị |
| **3** | **Journal** làm *nguồn dữ liệu cảm xúc* nuôi tương quan finance↔habit | Khác biệt thật. `CLAUDE.md` Finance Vision: emotion↔spending. | Journal có mood; AI dùng mood làm input cho insight finance |
| **4** | **Daily Brief** (giờ mới xây) | Lúc này đã có dữ liệu cross-module → Brief có chất, không rỗng. | Pass tiêu chí "earn 30 giây" §8 |
| **5** | **Goals** (lớp ý nghĩa) → **AI Coach** chủ động | Cần cả dữ liệu lẫn lòng tin. Goal là "tại sao", không phải bề mặt chính. | Goal đo bằng ≥2 nguồn dữ liệu; Coach phát hiện lệch hướng có dẫn nguồn |

**Khác biệt cốt lõi với roadmap doc cũ:** doc cũ gom Smart Capture + Daily Brief + Goal Engine vào Phase 1. Ở đây Daily Brief lùi xuống **Bước 4** và Goal Engine xuống **Bước 5**, vì cả hai là cái vỏ rỗng nếu thiếu dữ liệu cross-module.

> 🟥 **PHẢN BIỆN (Claude):** Điều kiện "xong" của Bước 2 — *"tối thiểu 1 tương quan finance↔habit hiển thị"* — **tự mâu thuẫn với chính §8** (item phải non-obvious, decision-relevant, data-backed). Ép phải show 1 tương quan trên dữ liệu vài tuần gần như chắc chắn cho ra **tương quan giả** ("thứ Ba tiêu nhiều hơn") — đúng loại nhiễu mà §8 cấm. Đặt mục tiêu "phải có correlation" là cách nhanh nhất để sản xuất correlation rác.
>
> 🟨 **GÓP Ý:** Đổi DoD thành điều kiện *có điều kiện*: "**khi** đủ mẫu và vượt ngưỡng ý nghĩa thống kê **thì** hiển thị tương quan; chưa đủ → im lặng." Tức chứng minh **đường ống tương quan + bộ lọc nhiễu** hoạt động, chứ không phải ép ra một con số đẹp để demo.

---

## 5. Bước 1a — Finance Smart Capture (chi tiết thực hiện)

### 5.1. Nguyên tắc (khớp `CLAUDE.md` Rule 3, 4, 5)
- **AI input là mặc định, form là fallback.** Nhưng phải "magic" >90% lần, nếu không thì tệ hơn form.
- **Domain-scoped TRƯỚC, global multi-intent SAU.** Bắt đầu chỉ với finance (ngữ pháp hẹp, đáng tin: số tiền + merchant/category). Global "tiêu 50k cafe, mai họp 9h, gym thứ 2" để sau khi finance capture đã ổn định.

### 5.2. Pre-parse tất định (KHÔNG bao giờ tin AI cho số học & ngày tháng)
Theo `smartEntry.ts` pattern. Parse bằng code trước, AI chỉ phân loại:

| Loại | Ví dụ input | Quy tắc |
|---|---|---|
| Số tiền | `50k`, `50.000`, `50000`, `1tr5`, `2 triệu`, `1,5tr` | Regex + bảng đơn vị VN; chuẩn hóa về số nguyên đồng |
| Ngày tương đối | `hôm qua`, `hôm kia`, `tuần trước`, `sáng nay`, `tối qua` | `CLAUDE.md` Rule 4 → `occurred_at` |
| Ngày tuyệt đối | `13/2`, `13/2/2023`, `Feb 13`, `2023-02-13` | `date-fns` parse |
| Còn lại (merchant/category/note) | `cafe`, `ăn trưa`, `grab` | Đẩy cho AI phân loại danh mục |

→ AI chỉ trả về: `category`, `merchant?`, `note?`. Số tiền & ngày luôn từ code.

> 🟥 **PHẢN BIỆN (Claude):** Có một mâu thuẫn chưa giải: `CLAUDE.md` bắt **offline-first**, nhưng phân loại category bằng AI **cần mạng**. Khi user gõ "trưa 50k" lúc mất mạng thì sao? Doc không nói. Nếu treo chờ network → hỏng trải nghiệm capture (chính là vòng lặp cốt lõi).
>
> 🟨 **GÓP Ý:** Cần **fallback phân loại tất định, on-device**: một bảng từ khóa → category ("cafe/cà phê→Ăn uống", "grab/xe→Đi lại", "netflix→Giải trí") chạy ngay không cần mạng; AI chỉ **tinh chỉnh khi online**. Như vậy capture luôn tức thì, AI là lớp nâng cấp chứ không phải đường tới hạn (critical path). Bonus: bảng từ khóa này cũng bắt được phần lớn case trước khi phải tốn một lượt gọi API.

### 5.3. Xác nhận trước khi lưu (`CLAUDE.md` Rule 5)
- Sheet xác nhận: echo input gốc ("Bạn nói: …") + tóm tắt đã parse ("Tài chính · 50.000 ₫ · Ăn uống · hôm nay") + nút **Lưu / Sửa / Hủy**.
- Tôn trọng `settingsStore.aiAutoConfirm` (mặc định `true`). Khi `false` → lưu thẳng + toast Undo 5s.
- **Voice luôn xác nhận** bất kể setting (lỗi transcription phổ biến).

### 5.4. Acceptance criteria
- [ ] Gõ "trưa 50k" → tạo giao dịch 50.000₫, category "Ăn uống", occurred_at = hôm nay, qua sheet xác nhận.
- [ ] Số tiền & ngày KHÔNG bao giờ do AI sinh (kiểm bằng test tất định).
- [ ] Sai category < 10% trên tập test thực tế tiếng Việt.
- [ ] Voice input luôn hiện sheet xác nhận.

> 🟨 **GÓP Ý (Claude):** Ngưỡng "sai category < 10%" / "parse đúng > 90%" (§13) là **tham vọng cho một v1 tiếng Việt** (viết tắt, không dấu, tiếng lóng vùng miền, "1tr5", "hai trăm rưỡi"). Rủi ro: chốt ngưỡng cứng rồi không đạt → tưởng thất bại. Đề xuất tách **hai mức đo**: *parse số tiền/ngày đúng* (phải ~100%, vì tất định) tách khỏi *đoán category đúng* (đặt mốc khiêm tốn hơn, vd 75–80% cho v1, cải thiện dần theo dữ liệu). Và thiết kế **thất bại duyên dáng**: khi AI không chắc category → mặc định "Chưa phân loại" + gợi ý 2–3 lựa chọn, đừng đoán bừa rồi giấu.

---

## 6. Bước 1b — Safe To Spend (chi tiết cơ chế)

### 6.1. Ba con số hiển thị (khớp đề xuất doc cũ — giữ)
1. **Có thể chi hôm nay** (Safe To Spend Today)
2. **Có thể chi mỗi ngày** (mức bền vững)
3. **Dự báo cuối tháng** (số dư dự kiến)

### 6.2. Mô hình tính (chế độ Ngân sách — cho người có thu nhập đều)
```
disposable_thang   = thu_nhap_du_kien − cam_ket_co_dinh − muc_tieu_tiet_kiem
allowance_ngay     = disposable_thang / so_ngay_trong_thang
safe_to_spend_today = allowance_ngay
                     + carryover (phần chưa tiêu các ngày trước)
                     − da_tieu_hom_nay
co_the_chi_moi_ngay = disposable_con_lai / so_ngay_con_lai
du_bao_cuoi_thang   = so_du_hien_tai − (run_rate_hien_tai × so_ngay_con_lai)
```
- `cam_ket_co_dinh` = tiền nhà + subscription + hóa đơn đã biết (lấy từ recurring/subscription detection trong Finance AI goals).

### 6.3. Chế độ Dòng tiền thực (cho **freelancer/founder thu nhập bất thường** — BẮT BUỘC có)
> Đây là điểm doc cũ bỏ sót. Đối tượng early-adopter (founder/freelancer) có thu nhập không đều → "thu_nhap_du_kien" là ảo.

```
safe_to_spend = tien_mat_kha_dung_thuc_te        (số dư có thật, không phải dự phóng)
               − cam_ket_sap_toi_da_biet          (bills đến hạn)
               − buffer_san (floor an toàn user đặt)
```
- Mặc định chọn chế độ này nếu phát hiện thu nhập không đều (variance cao).
- Cho user **chuyển chế độ** trong Settings → Finance.

### 6.4. Acceptance criteria
- [ ] Ba con số luôn hiển thị ở Home, cập nhật < 200ms sau khi thêm giao dịch.
- [ ] Có ≥2 chế độ: Ngân sách / Dòng tiền thực; tự gợi ý chế độ theo variance thu nhập.
- [ ] Carryover hoạt động đúng qua nhiều ngày (test rollover).
- [ ] Không bao giờ hiển thị số âm gây hoảng mà không kèm ngữ cảnh ("Bạn đã vượt — đây là cách điều chỉnh").

---

## 7. Bước 1c — Insight hành vi/cảm xúc chi tiêu

### 7.1. Nguyên tắc giọng điệu (cho nhóm ADHD/bận rộn — `CLAUDE.md` target)
- **Phê bình thay vì chỉ khen** (giữ đúng tinh thần doc cũ) NHƯNG **từ bi, không phán xét.**
  - ❌ "Bạn lại vượt ngân sách." (nhục mạ → bỏ app)
  - ✅ "3 ngày liền vượt mức ăn uống — thường rơi vào ngày bận. Đặt mức nhắc nhẹ?"
- Mỗi insight phải **kèm hành động đề xuất**, không chỉ phán xét.

### 7.2. Insight tối thiểu cho Bước 1 (chưa cần journal/habit)
- Vượt mức theo category nhiều ngày liền.
- Phát hiện subscription định kỳ ("Có vẻ Netflix 180k/tháng lặp lại — đúng không?").
- So sánh xu hướng tuần/tháng.

### 7.3. Ràng buộc ngôn ngữ & locale (`CLAUDE.md` Rule 2)
- AI prompt phải yêu cầu trả lời bằng `settingsStore.language` (qua `aiLanguage.ts`).
- Category labels seeded → dịch lúc hiển thị (`translateCategoryName`), không dịch input user tự tạo.
- Tiền/ngày/số → formatter theo `getIntlLocale(language)` / `getDateFnsLocale(language)`, KHÔNG hardcode.

---

## 8. Bước 4 — Daily Brief: tiêu chí "earn 30 giây"

> Daily Brief chỉ được xây sau khi có dữ liệu cross-module (Bước 2–3). Bar rất cao.

### 8.1. Mỗi item trong Brief PHẢI đạt cả 3
1. **Non-obvious** — không lặp lại con số user tự nhìn thấy được. ("Bạn tiêu 50k" → cấm).
2. **Decision-relevant** — ngụ ý một hành động.
3. **Data-backed** — dẫn nguồn dữ liệu cụ thể.

Ví dụ đạt: *"Đang trên đà vượt buffer tiền nhà ~400k cuối tháng — phần lớn đến từ ăn ngoài các ngày bạn ghi 'stress' trong nhật ký."*

### 8.2. Quy tắc chống rỗng
- Nếu không có item nào đạt bar → **hiển thị ÍT đi**, hoặc một dòng trung thực ("Hôm nay ổn, không có gì cần chú ý"). **Không bao giờ độn cho đủ.**
- Brief phải đọc xong trong **30 giây**.

---

## 9. Nguyên tắc thiết kế xuyên suốt

### 9.1. Graceful degradation (CỰC KỲ QUAN TRỌNG)
> App phải **đầy đủ giá trị khi CHỈ có dữ liệu finance.** Doc cũ tự thừa nhận Data Health Journal = 15% → giấc mơ cross-module bị đói dữ liệu.
- Không bao giờ để màn hình Brief/Coach trống rỗng chờ dữ liệu user chưa cho.
- Mỗi tính năng cross-module phải có trạng thái "chưa đủ dữ liệu" hữu ích, không phải spinner/empty buồn.

> 🟥 **PHẢN BIỆN (Claude) — đây là nghịch lý trung tâm của cả chiến lược:** Nếu app **đầy đủ giá trị chỉ với finance** (§9.1), thì **động lực nào** khiến user bỏ công ghi habit + viết journal (việc tần suất thấp, lười)? Moat = cross-module, nhưng nếu lát cắt finance đã "đủ no", flywheel không bao giờ quay sang habit/journal. Data Health (§10.4) chỉ là một **cú nudge yếu** — một thanh % không thắng nổi sự lười. Doc thừa nhận Journal 15% nhưng coi đó là "lời nhắc trực quan", chứ chưa **giải** bài toán kéo dữ liệu.
>
> 🟨 **GÓP Ý:** Cần một **móc kéo dữ liệu mạnh hơn nudge**: khiến journal/habit *trả công ngay trong trải nghiệm finance*. Ví dụ — khi xác nhận một giao dịch, hỏi một chạm cảm xúc ("😣 stress / 😀 vui / 😐 thường?"); thế là **mood được capture *bên trong* luồng finance**, không bắt user mở module riêng. Insight "ngày stress bạn tiêu +40%" xuất hiện sau 2 tuần → đó mới là cú aha tự nuôi flywheel. Quy tắc: **đừng bắt user đi sang module khác để nạp dữ liệu cross-module; nhúng micro-capture vào ngay vòng lặp finance.**

### 9.2. Progressive Capture ≠ Chatbot (giữ nguyên — doc cũ đúng)
- User gõ → AI trả về thẻ có cấu trúc (✓ loại, nội dung, [Xác nhận] [Bổ sung]) → user bổ sung → AI liên kết cùng context.
- KHÔNG phải multi-turn chat với ô trả lời tự do.

### 9.3. AI Transparency (giữ — `CLAUDE.md` Rule 8 + security)
- Hiển thị rõ "AI dùng: Finance, Habits, Journal / AI không dùng: Danh bạ, File."
- Location & finance là PII → không log raw, không gửi AI thô (round ~1km), tôn trọng wipe.

### 9.4. Goals là lớp ý nghĩa, không phải bề mặt chính
- Goal cho vòng lặp hàng ngày một phương hướng (AI tham chiếu goal khi viết insight/Brief).
- Goal đo bằng **≥2 nguồn dữ liệu** (vd "Tiết kiệm 20tr" = Finance + Task + Habit).
- KHÔNG làm Goal thành màn hình user "sống" trong đó.

---

## 10. Settings — cấu trúc lại theo mental model (góp ý chi tiết)

### 10.1. Vấn đề hiện tại
Settings đang tổ chức **theo module dữ liệu** (Finance settings, Habits settings, …). Đó là **rò rỉ tư duy kỹ thuật ra UX** — user không nghĩ theo "module", họ nghĩ theo *"tôi muốn làm gì"* (đăng nhập, sao lưu, đổi giao diện, chỉnh AI). Hệ quả: cùng một loại tác vụ (vd bật/tắt sync) bị rải ở 4 chỗ khác nhau.

### 10.2. Cấu trúc đề xuất (IA — 6 nhóm theo mental model)

| Nhóm | Mục con | Ghi chú thực hiện |
|---|---|---|
| **Tài khoản** | Hồ sơ · Đăng nhập / Đăng xuất · Gói & thanh toán | Gói = chỗ đặt monetization (§ Monetization doc cũ) |
| **Dữ liệu & Sao lưu** | **Cloud Sync (1 công tắc tổng)** · Export · Import · **Data Health / Dung lượng** | Xem §10.3 cho sync; §10.4 cho Data Health |
| **Riêng tư & Bảo mật** | Khóa app / Sinh trắc học · Quyền truy cập (Vị trí, Micro) · **AI Transparency** | `locationAccess` mặc định `false` (`CLAUDE.md` Rule 6); AI Transparency = §9.3 |
| **AI** | **AI Memory** (Giá trị · Quy tắc cá nhân) · `aiAutoConfirm` · Reset AI · Ngôn ngữ AI | Xem §10.5 |
| **Giao diện** | Theme (5 theme + dark/light) · Ngôn ngữ (6: en/vi/ja/ko/fr/zh) · Font | Ngôn ngữ chi phối cả AI (`CLAUDE.md` Rule 2) |
| **Thông báo** | Daily Brief · Nhắc nhập liệu · Task · Habit | Mặc định bật Daily Brief — đòn giữ chân (doc cũ) |

> **Nguyên tắc vàng:** mỗi setting phải map vào câu *"tôi muốn làm gì"*, không phải *"thuộc module nào"*. Nếu một mục phải hỏi "đây là Finance hay Habit?" → đặt sai chỗ.

### 10.3. Giải mâu thuẫn: 1 công tắc Sync vs. `CLAUDE.md` Rule 1 (per-module)
Doc cũ muốn "một công tắc Sync duy nhất". Nhưng `CLAUDE.md` Rule 1 **bắt buộc** mỗi module có sync toggle + export + wipe riêng. Hai cái không loại trừ nhau:

```
Dữ liệu & Sao lưu
 ├─ Cloud Sync           [●━━] (công tắc TỔNG — bật/tắt toàn bộ)
 │   └─ Quản lý theo module ›   (lớp nâng cao, mở ra mới thấy)
 │        ├─ Finance   sync [●━]  · Export · Xóa dữ liệu
 │        ├─ Habits    sync [●━]  · Export · Xóa dữ liệu
 │        └─ Journal   sync [●━]  · Export · Xóa dữ liệu
 ├─ Export tất cả (JSON/CSV)
 └─ Import
```
- **Mặc định:** công tắc tổng ON, tất cả module ON (`CLAUDE.md`: default ON).
- Export/Wipe **vẫn per-module** nhưng nằm dưới "Quản lý theo module" — UX gọn ở lớp ngoài, đủ chi tiết ở lớp trong.
- Wipe luôn trả về **số bản ghi đã xóa** để xác nhận (`CLAUDE.md`: wipe never silent fail).

### 10.4. Data Health (giữ ý doc cũ — và biến nó thành đòn nạp dữ liệu)
Hiển thị % độ đầy dữ liệu mỗi module:
```
Finance  ████████████████████  95%
Habits   ██████████████░░░░░░  70%
Journal  ███░░░░░░░░░░░░░░░░░  15%
```
- **Tác dụng kép:** vừa minh bạch, vừa là **nudge nạp dữ liệu** — khớp thẳng nguyên tắc moat ở §2 (tăng capture hàng ngày). Journal 15% chính là lời nhắc trực quan vì sao insight cross-module còn yếu.
- Mỗi thanh có CTA nhẹ: *"Thêm vài dòng nhật ký để AI hiểu cảm xúc chi tiêu của bạn."*

### 10.5. AI Memory trong Settings (mở rộng theo doc cũ)
Settings → AI → AI Memory cho user **xem / sửa / xóa** những gì AI nhớ, chia 2 lớp:
- **Giá trị cá nhân:** vd kỷ luật, học hỏi, gia đình.
- **Quy tắc cá nhân:** vd "không thức khuya", "cuối tuần dành cho con".
- Kèm `aiAutoConfirm` (`CLAUDE.md` Rule 5, default `true`) và nút **Reset AI** (xóa toàn bộ memory). Đây cũng là nơi thực thi tính minh bạch: user kiểm soát được trí nhớ của AI.

### 10.6. Settings là nơi THỰC THI nhiều Cross-Module Rule — đừng coi là phụ
| Setting | Ràng buộc `CLAUDE.md` |
|---|---|
| Cloud Sync / Export / Wipe per-module | Rule 1 |
| Ngôn ngữ (chi phối cả AI) | Rule 2 |
| `aiAutoConfirm` | Rule 5 |
| `locationAccess` (default `false`) | Rule 6 |
| AI Transparency / Error report | Rule 8 |

→ **Khuyến nghị thực hiện:** dựng khung 6 nhóm này **sớm** (ngay Bước 1), vì Finance đã cần Sync/Export/Wipe + `aiAutoConfirm` + ngôn ngữ. Mỗi module thêm vào chỉ "cắm" mục con của mình vào nhóm có sẵn, không tạo màn hình settings riêng.

### 10.7. Acceptance criteria
- [ ] Settings tổ chức theo 6 nhóm mental model, KHÔNG còn màn hình "settings theo module" rời rạc.
- [ ] Một công tắc Sync tổng + lớp "Quản lý theo module" (sync/export/wipe per-module) bên dưới.
- [ ] Wipe trả về số bản ghi đã xóa.
- [ ] Data Health hiển thị % mỗi module kèm CTA nạp dữ liệu.
- [ ] AI Memory xem/sửa/xóa được; có Reset AI và `aiAutoConfirm`.
- [ ] Đổi Ngôn ngữ áp dụng cả UI lẫn câu trả lời AI (kiểm bằng 1 insight finance).

---

## 11. Mâu thuẫn cần xử lý (đã có giải pháp)

| Mâu thuẫn | Giải pháp |
|---|---|
| "1 công tắc Sync" vs. `CLAUDE.md` Rule 1 (sync/export/wipe **per-module**) | **Xem §10.3** — công tắc tổng + lớp "Quản lý theo module". |
| Settings tổ chức theo module (góc nhìn kỹ thuật) | **Xem §10** — cấu trúc lại theo 6 nhóm mental model. |
| "Không cạnh tranh với ai" → không có category để search | Dẫn dắt marketing bằng **mũi nhọn Finance** (có nhu cầu, giải thích được); hé lộ "OS" dần. |

---

## 12. Target user — phải CHỌN cho v1

> Hai nhóm cần UX **ngược nhau** — không chiều cả hai ở v1.

| | ADHD / bận rộn (`CLAUDE.md`) | Founder / Freelancer / Productivity Geek (doc cũ) |
|---|---|---|
| Cần | Ma sát cực thấp, nhắc nhẹ, AI tự lo | Chiều sâu, cấu hình, kiểm soát |
| Rủi ro | — | Hay churn sang tool mới |
| Giọng AI | Từ bi, không shaming | Thẳng, dữ liệu |

**Khuyến nghị v1:** tối ưu cho **ADHD/bận rộn** làm cảm xúc-mũi-nhọn (nỗi đau cấp tính, sẵn lòng trả tiền, lời hứa "AI tự sắp xếp giúp bạn"). Founder/freelancer được phục vụ qua **chế độ Dòng tiền thực** (§6.3) mà không phải đổi toàn bộ UX. → **Chốt điểm này với product owner trước khi build.**

> 🟥 **PHẢN BIỆN (Claude):** Có một vênh giữa **nhóm tạo wedge cảm xúc** (ADHD/bận rộn) và **nhóm trả tiền** (founder/freelancer — chính nhóm Monetization mà doc cũ nêu). Doc chọn ADHD cho wedge nhưng lập luận "sẵn lòng trả tiền" lại đúng hơn với nhóm founder (đau về dòng tiền bất thường, quen trả tiền cho công cụ). Chọn sai trục có thể tối ưu cho một nhóm *thích* app nhưng *không trả tiền*.
>
> 🟨 **GÓP Ý:** Tách bạch hai câu hỏi: **ai làm tâm điểm cho UX** (→ ADHD-first, ma sát thấp: hợp lý) khác với **ai là người trả tiền đầu tiên** (→ có thể là founder/freelancer). May là chúng **không loại trừ nhau**: giữ UX ma-sát-thấp làm mặc định, và **chế độ Dòng tiền thực (§6.3) chính là tính năng "đáng trả tiền" cho nhóm founder**. Nhưng phải kiểm chứng willingness-to-pay sớm — đừng giả định nhóm ADHD vừa thích vừa chịu chi.

---

## 13. Định nghĩa thành công (metrics)

| Cấp | Chỉ số | Ngưỡng mục tiêu v1 |
|---|---|---|
| Vòng lặp | % ngày active mở app xem Safe To Spend | Bắc tinh giữ chân |
| Capture | Tỷ lệ giao dịch nhập qua Smart Capture (vs form) | > 60% |
| Chất lượng AI | Tỷ lệ parse đúng không cần sửa | > 90% |
| Retention | D1 / D7 / D30 | Theo dõi; D7 là tín hiệu PMF sớm |
| Câu hỏi PMF | "User quay lại mỗi ngày để xem GÌ?" | Phải là **Safe To Spend**, không phải "tạo task" |

> Test PMF của doc cũ vẫn đúng: *"Nếu user quay lại chỉ để tạo task thì BataVasa chưa khác biệt."* → v1 phải khiến họ quay lại vì **con số tài chính + insight hành vi.**

---

## 14. Anti-scope — những thứ KHÔNG làm ở v1 (kỷ luật)

- ❌ Daily Brief đầy đủ (lùi Bước 4 — rỗng nếu thiếu dữ liệu).
- ❌ Goal Engine làm trung tâm (lùi Bước 5 — lớp ý nghĩa).
- ❌ Global multi-intent Smart Capture (làm finance-scoped trước).
- ❌ Tagline/marketing "Personal Life OS".
- ❌ Chatbot tự do.
- ❌ Nhắm đại chúng (giữ niche early-adopter).
- ❌ AI Coach chủ động (cần lòng tin + dữ liệu — Bước 5).

---

## 15. Câu hỏi mở cần chốt trước khi code

1. **Target v1**: ADHD/bận rộn hay Founder/Productivity Geek? (§12 — khuyến nghị: ADHD-first, founder phục vụ qua chế độ Dòng tiền thực).
2. **Safe To Spend mặc định**: chế độ Ngân sách hay Dòng tiền thực làm default? Cách phát hiện thu nhập bất thường?
3. **Ngưỡng "magic"** của Smart Capture trước khi mở global multi-intent?
4. **Daily Brief**: nguồn dữ liệu tối thiểu (mấy module, bao nhiêu ngày lịch sử) để bật?

---

## 16. Bản đồ về codebase (để bắt tay làm)

| Hạng mục | Vị trí (theo `CLAUDE.md` folder structure) |
|---|---|
| Finance Smart Capture | mở rộng từ `smartEntry.ts` pattern; `features/finance/` |
| Safe To Spend | `features/finance/` + `services/` (logic thuần) + `store/financeStore.ts` |
| Insight chi tiêu | `ai/financeInsight.ts` |
| Ngôn ngữ AI | `services/ai/aiLanguage.ts`, `services/i18n/` (6 ngôn ngữ en/vi/ja/ko/fr/zh) |
| Translate category | `features/finance/i18n.ts` (`translateCategoryName`, `translateKind`) |
| Sync/Export/Wipe | shared sync engine — `docs/sync-offline.md` |
| Trạng thái sprint | cập nhật `docs/current-state.md` sau khi chốt doc này |

---

*Hết v1. Bước tiếp theo: chốt §15 với product owner → ghi quyết định vào `docs/current-state.md` → bắt đầu Bước 1 (§5–7).*

---

## 17. Tổng kết phản biện (Claude) — ba việc phải làm trước khi code

> Tài liệu v1 này **đúng về xương sống** (finance-first, đảo thứ tự phụ thuộc dữ liệu, lùi Brief/Goal). Tôi đồng tình ~85%. Nhưng nó **chưa chạm tới ba rủi ro có thể giết sản phẩm** — và cả ba cần được trả lời *trước* khi viết dòng code đầu tiên:
>
> 1. **Mệt mỏi nhập tay & độ chính xác của con số.** Safe To Spend là cả thesis, nhưng nó sai ngay khi user sót một giao dịch tiền mặt. Không có chiến lược chống-sót + lộ trình import/bank-sync → con số mất tin trong 2 tuần. *Đây là rủi ro số 1, hiện chưa có trong doc.*
> 2. **Nghịch lý flywheel cross-module (§9.1 vs moat).** Nếu finance-only đã đủ no, không ai nạp journal/habit. Lời giải không phải nudge mà là **nhúng micro-capture cảm xúc ngay trong luồng finance** (xem góp ý §9.1).
> 3. **Định vị trong category đẫm máu.** "App tài chính AI" có đối thủ nhiều vốn. Phải để lộ wedge cross-module trong thông điệp ngay từ đầu, kẻo thành "một app tài chính AI nữa".
>
> **Phần đã vững, giữ nguyên:** pre-parse tất định, kiến trúc Settings 6 nhóm theo mental model, giải mâu thuẫn sync tổng + per-module, kỷ luật anti-scope §14, tiêu chí "earn 30 giây" cho Brief.
>
> **Một dòng nếu chỉ nhớ một điều:** *Đừng để "finance-first" biến thành "finance-only". Mũi nhọn là finance; lưỡi dao là cross-module. Bán mũi nhọn, nhưng mài lưỡi dao từ ngày đầu.*
