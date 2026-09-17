# UI Spec: Bảng điều phối xe trên Mobile App (Dispatch Schedule Mobile)

**Ngày:** 2026-09-11  
**BA Doc:** `docs/ba/20260911_dispatch-schedule-mobile-analysis.md`  
**Role liên quan:** ADMIN, ACCOUNTANT, DISPATCHER (người có quyền `dispatch.view` / `dispatch.manage`)

---

## 1. User Journey

### Happy Path (Tra cứu và xem lịch)
```
BottomNavigationBar → Tab "Điều phối"
  → Màn hình tải dữ liệu ngày hôm nay (Skeleton loader → Dữ liệu hiển thị)
  → Thanh Toolbar: Hiển thị Ngày hiện tại (có nút Lùi/Tiến ngày, nút Hôm nay, nút chọn lịch DatePicker)
  → 3 Tabs: Xe nhỏ (N), Xe lớn (N), Lịch ngoài tuyến (N)
  → User chuyển tab → Danh sách card chuyến tương ứng hiển thị mượt mà
  → User kéo xuống (Pull-to-refresh) → Dữ liệu cập nhật mới nhất
```

### Happy Path (Tạo chuyến xe mới)
```
User click FAB (+) "Tạo chuyến"
  → Mở `DispatchFormScreen` (hoặc modal tạo chuyến)
  → User chọn Loại tuyến (Tuyến cố định / Tuyến ngoài)
  → User chọn Cỡ xe (Xe nhỏ / Xe lớn)
  → User chọn Biển số xe (Autocomplete / Dropdown) → Tự động hiển thị Tên tài xế & gán `driver_id`
  → User nhập Điểm nhận hàng *, Số tấn, CAN, Ghi chú
  → User click "Xác nhận tạo chuyến"
  → Nút submit loading → Toast success → Quay lại danh sách → Refresh dữ liệu ngày đang chọn
```

### Happy Path (Chỉnh sửa chuyến xe)
```
User click icon Sửa (✏️) trên card chuyến
  → Modal `DispatchEditDialog` mở ra với dữ liệu hiện tại
  → User chỉnh sửa Điểm nhận, Số tấn, CAN, Ghi chú
  → User click "Lưu cập nhật"
  → Loading spinner → Toast success → Modal đóng → Cập nhật card chuyến
```

---

## 2. Screen Inventory

### Screen 1: `DispatchScheduleScreen` (Màn hình chính Điều phối xe)
**Vị trí:** Tab "Điều phối" trên BottomNavigationBar  
**Quyền:** `dispatch.view` hoặc role `ADMIN`

#### Layout:
```
┌──────────────────────────────────────────────┐
│ [<-] Điều hành vận tải              [Refresh]│
├──────────────────────────────────────────────┤
│ [<]  📅 11/09/2026  [Hôm nay]  [>]           │
├──────────────────────────────────────────────┤
│ [🚗 Xe nhỏ (4)] [🚛 Xe lớn (2)] [🧭 Tuyến ngoài (1)] │
├──────────────────────────────────────────────┤
│ [Card chuyến 1]                              │
│   Biển số: 51C81056       Tài xế: Nguyễn Văn A│
│   Điểm nhận: Kho CLF - Bình Dương             │
│   Tấn: 2.5            CAN: MCC               │
│   Ghi chú: Giao trước 10h trưa               │
│   [✏️ Sửa]   [🗑️ Xóa]                          │
├──────────────────────────────────────────────┤
│ [Card chuyến 2]...                           │
└──────────────────────────────────────────────┘
                                  [(+) Tạo chuyến]
```

#### States:
| State | Trigger | UI hiển thị |
|---|---|---|
| Loading | Đang fetch `GET /api/dispatch-schedules?date=...` | Skeleton loading cards |
| Empty | API trả về 0 chuyến | Icon lịch trống + Text "Không có chuyến xe nào trong ngày này" |
| Error | API fail hoặc mất mạng | Icon cảnh báo đỏ + Thông báo lỗi + Nút "Thử lại" |
| Populated | Có chuyến xe | Danh sách Card bo góc, có badge số lượng chuyến trên từng Tab |

---

### Screen 2: `DispatchFormScreen` (Màn hình tạo mới chuyến xe)
**Mở khi:** Click FAB (+) hoặc nút Thêm chuyến

#### Layout:
```
┌──────────────────────────────────────────────┐
│ [<-] Tạo chuyến xe mới                       │
├──────────────────────────────────────────────┤
│ Loại tuyến *                                 │
│ (•) Tuyến cố định       ( ) Tuyến ngoài      │
│                                              │
│ Cỡ xe *                                      │
│ (•) Xe nhỏ              ( ) Xe lớn           │
│                                              │
│ Biển số xe *                                 │
│ [Dropdown chọn biển số xe...            ▼]   │
│ 👤 Tài xế: Nguyễn Văn A (Tự động gán)        │
│                                              │
│ Điểm nhận hàng *                             │
│ [Nhập địa chỉ / kho nhận hàng...         ]   │
│                                              │
│ Số tấn                  CAN                  │
│ [Nhập số tấn...]        [Nhập CAN...]        │
│                                              │
│ Ghi chú chuyến                               │
│ [Ghi chú thêm...]                            │
├──────────────────────────────────────────────┤
│ [Xác nhận tạo chuyến]                        │
└──────────────────────────────────────────────┘
```

---

### Screen 3: `DispatchEditDialog` (Hộp thoại sửa chuyến xe)
**Mở khi:** Click icon Sửa (✏️) trên card chuyến

#### Layout:
```
┌──────────────────────────────────────────────┐
│ Chỉnh sửa chuyến xe                      [X] │
├──────────────────────────────────────────────┤
│ 🚗 Xe 51C81056 - Tài xế: Nguyễn Văn A        │
│ Loại: Tuyến cố định • Xe nhỏ                 │
│                                              │
│ Điểm nhận hàng *                             │
│ [Kho CLF - Bình Dương                    ]   │
│                                              │
│ Số tấn                  CAN                  │
│ [2.5           ]        [MCC         ]       │
│                                              │
│ Ghi chú                                      │
│ [Giao trước 10h trưa                     ]   │
├──────────────────────────────────────────────┤
│ [Hủy]                         [Lưu cập nhật] │
└──────────────────────────────────────────────┘
```

---

## 3. Component & State Checklist

| Component | File Path | Mục đích |
|---|---|---|
| `DispatchScheduleModel` | `lib/data/models/dispatch_schedule.dart` | Data Model cho chuyến xe & response theo nhóm `xe_nho`, `xe_lon`, `tuyen_ngoai` |
| `DispatchScheduleService` | `lib/data/services/dispatch_schedule_service.dart` | Gọi API `GET`, `POST`, `PUT`, `DELETE /api/dispatch-schedules` |
| `DispatchScheduleProvider` | `lib/providers/dispatch_schedule_provider.dart` | State Management: ngày chọn, danh sách 3 nhóm, CRUD methods |
| `DispatchScheduleScreen` | `lib/screens/dispatch/dispatch_schedule_screen.dart` | Màn hình chính 3 Tab kèm Toolbar DatePicker |
| `DispatchFormScreen` | `lib/screens/dispatch/dispatch_form_screen.dart` | Màn hình tạo mới chuyến xe |
| `DispatchEditDialog` | `lib/screens/dispatch/dialogs/dispatch_edit_dialog.dart` | Dialog chỉnh sửa thông tin chuyến |
| `HomeScreen` | `lib/screens/home/home_screen.dart` | Bổ sung Tab "Điều phối" có phân quyền |
