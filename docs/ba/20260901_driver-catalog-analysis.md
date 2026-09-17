# BA Analysis: Danh mục tài xế

**Ngày:** 2026-09-01
**Feature:** Danh mục tài xế (Driver Catalog)
**Parent menu:** Quản lý danh mục (`/catalog/drivers`)

---

## 1. Yêu cầu & Mục đích
- Quản lý danh sách tài xế thuộc hệ thống.
- Khi thêm mới hoặc chỉnh sửa tài xế:
  - Chọn tài xế từ dropdown danh sách người dùng (`users` có trạng thái active). Mỗi tài xế phải gắn với 1 tài khoản đăng nhập (`user_id`).
  - Chọn danh sách xe mà tài xế này được phân công lái (quan hệ N - N: 1 tài xế có thể lái nhiều xe, 1 xe có thể có nhiều tài xế lái).
  - Danh sách xe trong dropdown chọn bao gồm tất cả các xe từ Danh mục xe (`vehicles`) đang hoạt động (`status = 'active'`), không phân biệt "Xe nhà" hay "Xe ngoài".
- Quản lý trạng thái tài xế (Active / Inactive, soft-delete hoặc toggle).

---

## 2. Business Rules
- **BR-001:** Mỗi `user_id` chỉ được tạo thành 1 record tài xế trong danh mục (Unique constraint trên active drivers).
- **BR-002:** Danh sách xe phân công lấy tất cả các xe có `status = 'active'` (cả Xe nhà và Xe ngoài).
- **BR-003:** Mối quan hệ giữa Driver và Vehicle là Many-to-Many (`driver_vehicles` table).
- **BR-004:** Khi toggle/deactivate tài xế hoặc xóa, cập nhật status về `deactive` / `deleted` tương ứng.
- **BR-005:** Danh sách tài xế hiển thị các cột: STT, Họ tên tài xế, Tên đăng nhập / Email, Danh sách xe phụ trách (kèm tag phân loại Xe nhà/Xe ngoài), Trạng thái, Ngày tạo, Thao tác (Sửa, Đổi trạng thái).

---

## 3. Data Model

### Bảng `drivers`
```sql
CREATE TABLE IF NOT EXISTS drivers (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status          VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deactive')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_user_id_active ON drivers(user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);
```

### Bảng trung gian `driver_vehicles`
```sql
CREATE TABLE IF NOT EXISTS driver_vehicles (
  id              SERIAL PRIMARY KEY,
  driver_id       INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  vehicle_id      INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(driver_id, vehicle_id)
);

CREATE INDEX IF NOT EXISTS idx_driver_vehicles_driver_id ON driver_vehicles(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_vehicles_vehicle_id ON driver_vehicles(vehicle_id);
```

---

## 4. API Contract

1. `GET /api/drivers?search=&status=&page=1&limit=20`
   - Response: `{ success: true, data: { drivers: [...], total, page, limit } }`
   - Mỗi item driver có: `id, user_id, full_name, username, email, status, notes, vehicles: [{ id, plate_number, vehicle_type }]`
2. `GET /api/drivers/available-users`
   - Danh sách users active (chưa được gán làm active driver hoặc bao gồm user hiện tại khi edit)
3. `GET /api/drivers/available-vehicles`
   - Danh sách vehicles active có `vehicle_type = 'Xe nhà'`
4. `POST /api/drivers`
   - Body: `{ user_id: number, vehicle_ids: number[], notes?: string }`
5. `PUT /api/drivers/:id`
   - Body: `{ vehicle_ids: number[], notes?: string }` (hoặc đổi user nếu cần)
6. `PATCH /api/drivers/:id/toggle`
   - Toggle active / deactive

---

## 5. UI Inventory
- Page: `DriverCatalogPage.tsx` tại route `/catalog/drivers`
- Modal: `DriverFormModal.tsx` (Thêm mới / Chỉnh sửa với multi-select xe nhà)
