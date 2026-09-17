# Task List: Điều hành vận tải trên Mobile (Dispatch Schedule Mobile)
**Ngày:** 2026-09-11  
**BA Doc:** `docs/ba/20260911_dispatch-schedule-mobile-analysis.md`  
**UI Spec:** `docs/ui/20260911_dispatch-schedule-mobile-ui-spec.md`  

---

## ⚙️ BACKEND TASKS
*Ghi chú: Backend đã có đầy đủ 5 API endpoints tại `/api/dispatch-schedules`, không cần chỉnh sửa Backend.*

## 🎨 FRONTEND / MOBILE TASKS

| ID | Task | Chi tiết kỹ thuật | Effort |
|---|---|---|---|
| **FE-01** | Core Endpoints & Models | Thêm `dispatchSchedules` vào `api_endpoints.dart`. Tạo `dispatch_schedule.dart` (Model `DispatchScheduleItem`, `DispatchScheduleResponse` với 3 mảng `xe_nho`, `xe_lon`, `tuyen_ngoai`). | S |
| **FE-02** | Service Layer | Xây dựng `dispatch_schedule_service.dart` gọi 5 API endpoints (`listByDate`, `create`, `update`, `remove`, `fetchActiveVehicles`). | S |
| **FE-03** | State Management Provider | Xây dựng `dispatch_schedule_provider.dart` quản lý `selectedDate`, danh sách 3 nhóm chuyến, bộ đếm số lượng, và các hành động CRUD. | M |
| **FE-04** | Main Screen & Tabs | Xây dựng `dispatch_schedule_screen.dart` gồm thanh công cụ DatePicker (Hôm nay, lùi/tiến ngày) và 3 Tabs: Xe nhỏ, Xe lớn, Lịch ngoài tuyến; card hiển thị thông tin chuyến xe. | M |
| **FE-05** | Form & Edit Modals | Xây dựng `dispatch_form_screen.dart` (Tạo chuyến xe mới) và `dispatch_edit_dialog.dart` (Chỉnh sửa chuyến xe). | S |
| **FE-06** | Navigation & MultiProvider | Đăng ký `DispatchScheduleProvider` vào `main.dart`. Bổ sung Tab "Điều phối" vào `HomeScreen` có phân quyền `dispatch.view` / `dispatch.manage`. | XS |
| **FE-07** | Unit & Widget Tests | Viết test trong `test/dispatch_schedule_test.dart` và chạy `flutter analyze` & `flutter test`. | S |

---

## 📊 Thứ tự thực hiện

Phase 3-10: FE-01 → FE-02 → FE-03 → FE-04 → FE-05 → FE-06 → FE-07 → Update Docs
