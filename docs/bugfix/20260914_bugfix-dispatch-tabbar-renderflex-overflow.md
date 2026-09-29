# Bug Fix: RenderFlex Overflow trong TabBar Điều hành vận tải (Mobile)

**Ngày:** 2026-09-14  
**Feature:** Điều hành vận tải (Mobile)  
**File ảnh hưởng:** `mobile/web_v2_mobile/lib/screens/dispatch/dispatch_schedule_screen.dart`  

---

## 1. Vấn đề (Bug)
- Khi mở màn hình **Điều hành vận tải** trên ứng dụng Flutter Mobile, terminal hiển thị lỗi:
  ```
  Another exception was thrown: A RenderFlex overflowed by 12 pixels on the right.
  ```

## 2. Nguyên nhân (Root Cause)
- Mặc định widget `TabBar` trong Flutter có `labelPadding` ngang là `16.0` pixels mỗi bên (tổng padding = 32px cho mỗi tab item).
- Màn hình chia 3 tabs cố định với các tiêu đề dài kết hợp icon:
  - Tab 1: `[Icon] Xe nhỏ (0)`
  - Tab 2: `[Icon] Xe lớn (0)`
  - Tab 3: `[Icon] Tuyến ngoài (0)`
- Với chiều rộng màn hình di động phổ biến (360px - 375px), mỗi tab có độ rộng khả dụng khoảng 93px (sau khi trừ 32px padding). Tab 3 chứa Icon (16px) + Spacing (4px) + Chữ "Tuyến ngoài (0)" (~85px) = 105px, vượt quá 93px đúng 12px dẫn đến `RenderFlex overflowed by 12 pixels on the right`.

## 3. Giải pháp (Fix)
- Thêm `labelPadding: const EdgeInsets.symmetric(horizontal: 4)` vào `TabBar` để giải phóng không gian hiển thị cho các tabs.
- Đặt `MainAxisSize.min` và bọc `Text` trong `Flexible(child: Text(..., overflow: TextOverflow.ellipsis, maxLines: 1))` cùng kích thước icon `15px` để đảm bảo vừa vặn tuyệt đối trên mọi độ phân giải màn hình mà không bị tràn.

## 4. Kiểm thử (Verification)
- Đã bổ sung regression test trong `mobile/web_v2_mobile/test/dispatch_schedule_test.dart` kiểm tra kích thước màn hình nhỏ hẹp (360x640).
- Chạy `flutter test` và `flutter analyze` 100% passed không có lỗi.
