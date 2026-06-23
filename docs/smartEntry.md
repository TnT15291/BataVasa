# Progressive Capture (Multi-Step Smart Input)

## Problem

Flow hiện tại:

User Input

↓

AI Parse

↓

Confirm

↓

Save

Mặc dù nhanh nhưng vẫn tạo cảm giác:

"Tôi đang điền form."

Thay vì:

"Tôi đang nói với trợ lý của mình."

---

# Goal

Tạo cảm giác hội thoại tự nhiên nhưng vẫn giữ tốc độ nhập liệu cao.

Mục tiêu KHÔNG phải xây chatbot.

Mục tiêu là xây dựng trải nghiệm:

Conversation-driven Capture.

---

# Concept

Sau khi AI parse thành công:

Hiển thị:

✓ Đã hiểu

* Họp tại cơ quan
* 09:00 ngày mai

Actions:

[Xác nhận]
[Bổ sung]

---

# Progressive Capture Flow

User:

Ngày mai họp 09h tại cơ quan.

---

AI:

✓ Công việc

* Họp tại cơ quan
* 09:00 ngày mai

[Xác nhận]
[Bổ sung]

---

User chọn:

Bổ sung

---

User:

Nhớ mang theo hồ sơ dự án.

---

AI:

✓ Công việc

* Họp tại cơ quan
* 09:00 ngày mai

✓ Ghi chú

* Mang theo hồ sơ dự án

[Xác nhận]
[Bổ sung]

---

User:

Nhắc tôi trước 30 phút.

---

AI:

✓ Công việc

* Họp tại cơ quan
* 09:00 ngày mai

✓ Ghi chú

* Mang theo hồ sơ dự án

✓ Nhắc nhở

* 08:30 ngày mai

[Xác nhận tất cả]

---

# UX Principle

Không reset phiên làm việc sau mỗi lần parse.

AI phải giữ context của phiên hiện tại.

Người dùng có thể bổ sung ý định theo từng bước.

---

# Terminology

Không dùng:

* Thêm nữa

Ưu tiên:

* Bổ sung
* Tiếp tục

Lý do:

Nghe giống một cuộc hội thoại hơn.

---

# Design Rule

Progressive Capture chỉ xuất hiện sau khi AI parse thành công.

Không hiển thị mặc định.

Không thay thế flow xác nhận hiện tại.

Là một lớp trải nghiệm nâng cao trên Smart Input.

---

# Technical Requirement

Smart Input Session cần duy trì:

* Parsed entities hiện tại
* Context hội thoại
* Draft objects chưa lưu

Cho tới khi:

* User xác nhận
* User hủy
* Timeout session

---

# Product Principle

Mục tiêu không phải Multi-turn Chat.

Mục tiêu là Progressive Capture.

Người dùng xây dựng dần một nhóm ý định liên quan thông qua nhiều câu ngắn liên tiếp.

Ví dụ:

1. Ngày mai họp 09h tại cơ quan.
2. Mang theo hồ sơ dự án.
3. Nhắc tôi trước 30 phút.

AI tự liên kết các ý định thành một cụm logic thống nhất.

---

# Strategic Value

Nếu Smart Capture giúp người dùng:

"Nhập dữ liệu nhanh hơn"

thì Progressive Capture giúp người dùng:

"Suy nghĩ tự nhiên hơn"

Đây là bước chuyển từ:

AI Form

sang

AI Personal Assistant Experience.

Không làm giảm tốc độ nhập liệu nhưng tăng đáng kể cảm giác rằng BataVasa đang hiểu và đồng hành cùng người dùng.
