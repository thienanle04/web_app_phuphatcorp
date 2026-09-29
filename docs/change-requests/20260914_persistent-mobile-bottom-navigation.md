# Change Request: Duy trì Footer Menu (Bottom Navigation Bar) cố định ở tất cả các trang trên Mobile

**Ngày:** 2026-09-14  
**Feature:** Mobile Navigation Shell & Persistent Bottom Navigation  
**Phạm vi:** Flutter Mobile App (`mobile/web_v2_mobile`)  

---

## 1. Bối cảnh & Yêu cầu
- **Vấn đề:** Khi truy cập vào các module tính năng con (như *Điều phối xe*, *Theo dõi HĐ*, *Đăng kiểm*, *Bảo hiểm*, *Thay nhớt*...), `Navigator.push` trước đây đẩy màn hình mới đè lên toàn bộ `HomeScreen`, khiến thanh menu dưới đáy (Footer menu / `BottomNavigationBar`) bị mất. Người dùng muốn quay về trang chủ hoặc đổi sang tài khoản phải nhấn nút Back nhiều lần.
- **Yêu cầu:** Duy trì thanh Footer menu luôn hiển thị ở tất cả các màn hình chi tiết, cho phép chuyển tab linh hoạt và 1-chạm quay về trang chủ.

## 2. Giải pháp kỹ thuật (Implementation)
- **Cấu trúc Tab Shell với Nested Navigators:**
  - `HomeScreen` sử dụng `IndexedStack` quản lý 2 `Navigator` độc lập cho 2 Tabs: Tab 0 (`DashboardHubTab`) và Tab 1 (`_ProfileTab`).
  - Mỗi `Navigator` sở hữu một `GlobalKey<NavigatorState>()`.
  - Mọi thao tác `Navigator.push(...)` từ `DashboardHubTab` hoặc các màn hình con đều được đẩy vào `Navigator` của Tab 0, giúp `BottomNavigationBar` ở tầng ngoài cùng của `HomeScreen` luôn luôn hiển thị cố định.
- **1-Tap Reset to Home:**
  - Khi người dùng đang ở bất kỳ trang sâu nào của Tab 0, nếu chạm vào icon **"Trang chủ"** trên `BottomNavigationBar`, hàm `_onTabTapped` sẽ gọi `popUntil((route) => route.isFirst)` để đưa người dùng trở về ngay màn hình Hub chính chỉ với 1 chạm.
- **Xử lý nút Back hệ thống (`PopScope`):**
  - Sử dụng `PopScope` với `canPop: false` và `onPopInvokedWithResult`:
    - Nếu tab hiện tại có thể `pop()`, thực hiện `currentNavigator.pop()`.
    - Nếu tab hiện tại đang ở Tab 1 (Tài khoản), chuyển về Tab 0 (Trang chủ).
    - Nếu đang ở root của Tab 0, gọi `SystemNavigator.pop()` để thoát / minimize app.

## 3. Danh sách file thay đổi
- `mobile/web_v2_mobile/lib/screens/home/home_screen.dart` (Refactor sang IndexedStack + Nested Navigators + PopScope)
- `mobile/web_v2_mobile/test/home_navigation_test.dart` (Bổ sung test suite cho persistent navigation & 1-tap reset)

## 4. Kết quả kiểm thử
- `flutter test`: 41/41 test cases PASSED.
- `flutter analyze`: 0 issues found.
