# Task List: Sửa lỗi RenderFlex Overflow trong TicketDetailScreen trên Mobile

**Ngày:** 2026-09-13  
**Bug:** `RenderFlex overflowed by 62 pixels on the right` tại `ticket_detail_screen.dart:378`  

---

## 🎨 FRONTEND / MOBILE TASKS

| ID | Task | Chi tiết kỹ thuật | Effort |
|---|---|---|---|
| **BFE-01** | Fix RenderFlex Header Overflow | Trong `lib/screens/invoice_tracking/ticket_detail_screen.dart`: bọc tiêu đề trong `Expanded` với `TextOverflow.ellipsis`, chuyển 2 nút action trên header sang dạng nút bấm gọn gàng (`InkWell` + padding tối thiểu) để không bao giờ bị tràn chiều ngang. | XS |
| **BFE-02** | Widget Regression Test | Cập nhật / thêm test case trong `test/copy_documents_test.dart` và `test/invoice_tracking_test.dart` kiểm tra render màn hình trên kích thước màn hình hẹp (320px width). | XS |

## 📊 Thứ tự thực hiện
Phase 4: BFE-01 → Phase 5: BFE-02 (Verify) → Phase 6: Document
