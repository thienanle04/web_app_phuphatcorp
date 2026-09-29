# Task List: Sửa lỗi RenderFlex Overflow trong TabBar Điều hành vận tải (Mobile)

**Ngày:** 2026-09-14  
**Bug:** `A RenderFlex overflowed by 12 pixels on the right` tại `dispatch_schedule_screen.dart:139-178`  

---

## 🎨 FRONTEND / MOBILE TASKS

| ID | Task | Chi tiết kỹ thuật | Effort |
|---|---|---|---|
| **BFE-01** | Tối ưu TabBar Layout & Padding | Trong `mobile/web_v2_mobile/lib/screens/dispatch/dispatch_schedule_screen.dart`: thiết lập `labelPadding: const EdgeInsets.symmetric(horizontal: 4)`, điều chỉnh các widget con của `Tab` với `MainAxisSize.min`, `Flexible` / `Text(overflow: TextOverflow.ellipsis)` để đảm bảo các tab hiển thị vừa vặn trên mọi kích thước màn hình mà không bị overflow. | XS |
| **BFE-02** | Widget Regression Test | Cập nhật / thêm test case trong `test/dispatch_schedule_test.dart` chạy test với kích thước màn hình nhỏ hẹp (width: 360px, 320px) xác nhận không còn exception overflow. | XS |

## 📊 Thứ tự thực hiện
Phase 4: BFE-01 → Phase 5: BFE-02 (Verify) → Phase 6: Document
