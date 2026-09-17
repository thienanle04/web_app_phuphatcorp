# BA Analysis: Xóa chức năng "Lịch đi hàng" (Delivery Schedules)

**Ngày:** 2026-08-19  
**Loại:** Feature Removal  
**BA:** AI Assistant

---

## 1. Tổng quan

**Yêu cầu:** Xóa toàn bộ chức năng "Lịch đi hàng" (delivery_schedules) khỏi hệ thống.

**Lý do:** 
- Chức năng "Xử lý Data Gạo" đã chuyển sang dùng `driver_invoices` (Hóa đơn tài xế) làm master data thay vì `delivery_schedules`
- Không còn use case nào sử dụng `delivery_schedules`
- Giảm complexity và maintenance burden

**Scope:**
- Xóa toàn bộ BE: service, controller, routes, API endpoints
- Xóa toàn bộ FE: page, components, API client, sidebar menu, router
- Xóa DB: DROP TABLE `delivery_schedules`
- Sửa Dashboard: thay thế KPIs dùng `delivery_schedules` bằng `driver_invoices` hoặc remove

---

## 2. Feature bị xóa

### 2.1 Chức năng "Lịch đi hàng"

**Mô tả:** Upload Excel lịch chuyến xe, lưu vào DB để làm master data cho "Xử lý Data Gạo".

**Route:** `/vehicle-data/delivery-schedule`  
**Sidebar:** "Dữ liệu xe" → "Lịch đi hàng"

**Data model — bảng `delivery_schedules`:**
```sql
delivery_schedules (
  id SERIAL PK,
  ngay DATE NOT NULL,
  stt INTEGER,
  noi_giao VARCHAR(255),
  tai_xe VARCHAR(255),
  so_xe VARCHAR(50),
  tan NUMERIC,
  loai VARCHAR(50),  -- 'Giá tấn' | 'Giá chuyến'
  ghi_chu TEXT,
  original_filename VARCHAR(255),
  uploaded_by INTEGER FK→users.id,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
)
```

**API Endpoints:**
```
POST   /api/delivery-schedules/upload     → upload Excel
GET    /api/delivery-schedules            → list + pagination + filters
DELETE /api/delivery-schedules/by-date-range → delete by date range
PUT    /api/delivery-schedules/:id        → update by id
DELETE /api/delivery-schedules/:id        → delete by id
GET    /api/delivery-schedules/statistics → statistics summary
```

**Files liên quan:**
- Backend: service, controller, routes (3 files)
- Frontend: page, 9 components, API client (11 files)
- Migrations: 010_create_delivery_schedules.sql, 011_add_loai_to_delivery_schedules.sql

---

## 3. Ảnh hưởng feature khác

### 3.1 Dashboard > Tổng quan (Overview)

**KPI bị ảnh hưởng:** `trip_count` (số chuyến)

**Query hiện tại:**
```sql
SELECT COUNT(*)::int
FROM delivery_schedules WHERE ngay >= $1::date
```

**Phương án:**
- **Option A:** Remove KPI này (không thay thế)
- **Option B:** Thay bằng `trip_count` từ `driver_invoices` (COUNT DISTINCT so_xe)

**Khuyến nghị:** Option A — remove, vì `driver_invoices` không phải là "chuyến" mà là "hóa đơn".

### 3.2 Dashboard > Vận tải (Operations)

**KPIs bị ảnh hưởng:**
- `total_trips` (tổng số chuyến)
- `total_tons` (tổng tấn)
- `vehicle_count` (số xe)
- `daily` (biểu đồ chuyến/tấn theo ngày)
- `by_vehicle` (thống kê theo xe)

**Query hiện tại:** Tất cả query từ `delivery_schedules`

**Phương án:**
- **Option A:** Remove toàn bộ tab "Vận tải"
- **Option B:** Thay bằng data từ `driver_invoices` (chỉ có `record_count`, `invoice_count`)
- **Option C:** Giữ tab nhưng chỉ hiển thị `driver_invoices` stats, remove các KPIs khác

**Khuyến nghị:** Option C — giữ tab, đổi tên thành "Hóa đơn tài xế", chỉ hiển thị stats từ `driver_invoices`.

### 3.3 Sidebar

**Menu item bị xóa:** "Lịch đi hàng" trong group "Dữ liệu xe"

**Sau khi xóa:**
- Group "Dữ liệu xe" chỉ còn: "Mã chuyến", "Xe", "Tài xế", "Hóa đơn tài xế"

### 3.4 Audit Log

**Label bị xóa:** `delivery_schedule: 'Lịch đi hàng'` trong `AuditLogPage.tsx`

**Ảnh hưởng:** Các audit log cũ có `entity_type = 'delivery_schedule'` vẫn hiển thị được (chỉ mất label, fallback về raw value).

---

## 4. Migration Plan

### 4.1 Migration mới

**File:** `backend/src/migrations/0XX_drop_delivery_schedules.sql`

**Nội dung:**
```sql
-- Drop delivery_schedules table (feature removed 2026-08-19)
-- No other tables reference this table (no FK dependencies)

DROP TABLE IF EXISTS delivery_schedules;
```

**Ghi chú:**
- Không có FK dependencies từ bảng khác
- Data sẽ mất vĩnh viễn — không thể rollback sau khi chạy migration
- Khuyến nghị backup data trước khi chạy

### 4.2 Rollback plan

Nếu cần rollback:
1. Revert code changes (git revert)
2. Chạy lại migration 010 + 011 để recreate table
3. Data cũ không thể restore (trừ khi có backup)

---

## 5. Acceptance Criteria

### 5.1 Backend
- [ ] Xóa `deliveryScheduleService.ts`
- [ ] Xóa `deliveryScheduleController.ts`
- [ ] Xóa `routes/deliverySchedule.ts`
- [ ] Remove route mount trong `routes/index.ts`
- [ ] Sửa `dashboardService.ts`:
  - [ ] Overview: remove `trip_count` KPI
  - [ ] Operations: thay bằng `driver_invoices` stats
- [ ] Chạy migration DROP TABLE
- [ ] Backend build + lint pass

### 5.2 Frontend
- [ ] Xóa `deliveryScheduleApi.ts`
- [ ] Xóa `DeliverySchedulePage.tsx`
- [ ] Xóa 9 components trong `delivery-schedule/`
- [ ] Remove route trong `Router.tsx`
- [ ] Remove sidebar item trong `MainLayout.tsx`
- [ ] Remove label trong `AuditLogPage.tsx`
- [ ] Frontend build + lint + typecheck pass

### 5.3 Dashboard
- [ ] Overview tab: không còn `trip_count`
- [ ] Operations tab: chỉ hiển thị `driver_invoices` stats
- [ ] Không có console errors

### 5.4 Documentation
- [ ] Update `system-features.md`: remove section "Lịch đi hàng"
- [ ] Update `know-how.md`: remove API endpoints + DB schema
- [ ] Update `lessons-learned.md`: ghi nhận change này

---

## 6. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Mất data `delivery_schedules` | High | Backup table trước khi DROP |
| Dashboard KPIs bị thiếu | Medium | Replace bằng `driver_invoices` stats hoặc remove |
| Audit log cũ mất label | Low | Fallback về raw value `delivery_schedule` |
| User confusion (menu item biến mất) | Low | Communicate trước khi deploy |

---

## 7. Timeline ước lượng

| Phase | Tasks | Effort |
|-------|-------|--------|
| BE | Xóa service/controller/routes + sửa dashboard | S |
| Migration | DROP TABLE | XS |
| FE | Xóa page/components + sửa sidebar/router | S |
| QA | Test dashboard + check console errors | S |
| Docs | Update knowhow docs | XS |
| **Tổng** | | **M** |

---

## 8. Out of Scope

- Không xóa `dispatch_schedules` (Bảng điều phối xe) — feature khác, vẫn đang dùng
- Không xóa `driver_invoices` (Hóa đơn tài xế) — đang dùng cho "Xử lý Data Gạo"
- Không thay đổi logic "Xử lý Data Gạo" — đã update ở change request trước

---

## 9. Approval

- [ ] Tech Lead approve
- [ ] Product Owner approve
- [ ] DBA approve (cho migration DROP TABLE)
