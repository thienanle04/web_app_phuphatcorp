# UI Spec: Danh mục tài xế

**Ngày:** 2026-09-01
**BA Doc:** docs/ba/20260901_driver-catalog-analysis.md

---

## 1. User Journey

### Thêm tài xế mới
1. User click "Quản lý danh mục" -> "Danh mục tài xế"
2. Bấm nút "Thêm mới" -> Modal `DriverFormModal` mở ra
3. Chọn tài xế từ dropdown (lấy từ Users active)
4. Chọn 1 hoặc nhiều xe từ danh sách "Xe nhà" (multi-select / checkboxes / tags)
5. Nhập ghi chú (optional)
6. Bấm "Thêm mới" -> Toast thông báo thành công, danh sách reload

### Sửa tài xế
1. User bấm icon "Sửa" ở dòng tài xế
2. Modal mở lên với thông tin tài xế và danh sách xe đã chọn trước đó
3. User cập nhật danh sách xe / ghi chú
4. Bấm "Lưu" -> Toast thành công, danh sách reload

### Đổi trạng thái Active / Inactive
1. User bấm nút toggle trạng thái trên bảng
2. Gọi API PATCH toggle -> Cập nhật badge và toast thông báo

---

## 2. Screen Inventory

### Screen 1: DriverCatalogPage (`/catalog/drivers`)
- Header: Tiêu đề "Danh mục tài xế", Nút "Thêm mới"
- Filter Toolbar:
  - Input Search (Tìm theo tên tài xế, username, biển số xe)
  - Select Status (Tất cả, Active, Inactive)
- Table:
  - STT
  - Họ tên tài xế
  - Tên đăng nhập / Email
  - Xe phụ trách (hiển thị danh sách badge biển số xe, e.g. `50H12345`, `50H67890`)
  - Trạng thái (Active / Inactive badge)
  - Ngày tạo
  - Thao tác (Sửa, Toggle Trạng thái)
- Pagination

### Modal 1: DriverFormModal
- Form fields:
  - Tài khoản người dùng (Select: Họ tên - username) - Bắt buộc
  - Xe phụ trách (Multi-select / Checkbox list chỉ hiển thị các xe có phân loại là "Xe nhà") - Bắt buộc chọn ít nhất 1 xe hoặc optional tùy nhu cầu
  - Ghi chú (Textarea / Input)
- Actions: Hủy, Lưu / Thêm mới
