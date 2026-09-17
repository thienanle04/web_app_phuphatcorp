# Change Request: Auto-fill Driver from Vehicle Assignment

**Ngày:** 2026-09-01  
**Impact:** MEDIUM  
**Migration:** Không

---

## Mục tiêu

Khi tạo chuyến xe, input "Tài xế" sẽ:
1. Hiển thị dropdown chỉ chứa drivers được gán cho xe đó (qua `driver_vehicles`)
2. Auto-fill driver đầu tiên trong danh sách
3. Lưu `driver_id` (= `driver.user_id`) vào `dispatch_schedules`

---

## Tasks

### Backend

| ID | Task | Chi tiết |
|----|------|----------|
| CR-01 | Thêm API `GET /api/drivers/by-vehicle/:vehicleId` | - Query: `SELECT d.* FROM drivers d JOIN driver_vehicles dv ON dv.driver_id = d.id WHERE dv.vehicle_id = $1 AND d.status = 'active'`<br>- Response: `{ drivers: [{ id, user_id, full_name, username }] }`<br>- File: `driverService.ts`, `driverController.ts`, `drivers.ts` routes |
| CR-02 | Cập nhật `dispatchScheduleService.createBatch` | - Thêm field `driver_id?: number` vào `CreateDispatchScheduleBatchItem`<br>- INSERT query thêm `driver_id` column<br>- File: `dispatchScheduleService.ts` |
| CR-03 | Cập nhật validation schema | - Thêm `driver_id` optional vào batch create schema<br>- File: `dispatchScheduleController.ts` |

### Frontend

| ID | Task | Chi tiết |
|----|------|----------|
| CR-04 | Thêm API client `getDriversByVehicle` | - File: `driverApi.ts`<br>- Endpoint: `GET /api/drivers/by-vehicle/:vehicleId` |
| CR-05 | Cập nhật `CreateScheduleModal` | - Thêm state `driversByVehicle: Map<vehicleId, Driver[]>`<br>- Khi chọn xe: fetch drivers, auto-fill first<br>- Đổi input thành dropdown select<br>- Lưu `driver_id` khi submit<br>- File: `CreateScheduleModal.tsx` |
| CR-06 | Cập nhật API types | - Thêm `driver_id?: number` vào `CreateDispatchScheduleBatchItem`<br>- File: `dispatchApi.ts` |

---

## Thứ tự thực hiện

```
CR-01 (BE: API drivers by vehicle)
  ↓
CR-02 (BE: lưu driver_id)
  ↓
CR-03 (BE: validation)
  ↓
CR-04 (FE: API client)
  ↓
CR-05 (FE: UI logic)
  ↓
CR-06 (FE: types)
```

---

## Ghi chú kỹ thuật

### Data flow

```
User chọn xe (vehicle_id)
  ↓
FE fetch GET /api/drivers/by-vehicle/:vehicleId
  ↓
BE query drivers qua driver_vehicles junction
  ↓
FE nhận [{ id, user_id, full_name, username }]
  ↓
Auto-fill: driver[0] (nếu có)
  ↓
User có thể đổi selection
  ↓
Submit: gửi { vehicle_id, driver_id, tai_xe (display name) }
```

### Fallback

- Nếu xe chưa có driver nào → dropdown trống, user nhập tay `tai_xe` (string)
- Nếu là "Xe ngoài" → không có driver assignment → nhập tay

### Edge cases

- Xe có nhiều drivers → ưu tiên driver đầu tiên (theo `driver_vehicles.created_at ASC`)
- Driver deactive → không hiển thị trong dropdown
- User đổi xe → clear driver selection, fetch lại
