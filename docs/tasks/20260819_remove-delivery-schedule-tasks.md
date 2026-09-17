# Task List: Xóa chức năng "Lịch đi hàng" (Delivery Schedules)
**Ngày:** 2026-08-19
**BA Doc:** docs/ba/20260819_remove-delivery-schedule-analysis.md

---

## ⚙️ BACKEND TASKS

| ID | Task | Chi tiết kỹ thuật | Effort |
|----|------|-------------------|--------|
| BE-01 | Sửa dashboardService.ts | Overview: remove `trip_count` query (dòng 211-212). Operations: thay 3 queries `delivery_schedules` bằng 1 query `driver_invoices` (summary + daily + by_vehicle). Update type `OperationsData` cho phù hợp. | M |
| BE-02 | Xóa BE files | Xóa: `deliveryScheduleService.ts`, `deliveryScheduleController.ts`, `routes/deliverySchedule.ts` | S |
| BE-03 | Sửa routes/index.ts | Remove `import deliveryScheduleRoutes` + `router.use('/delivery-schedules', ...)` | XS |
| BE-04 | Migration DROP TABLE | Tạo `0XX_drop_delivery_schedules.sql`: `DROP TABLE IF EXISTS delivery_schedules;` | XS |
| BE-05 | Lint + Build BE | `npm run lint && npm run build` | XS |

## 🎨 FRONTEND TASKS

| ID | Task | Chi tiết kỹ thuật | Effort |
|----|------|-------------------|--------|
| FE-01 | Xóa FE components | Xóa toàn bộ thư mục `frontend/src/components/delivery-schedule/` (9 files): DeliveryScheduleTable, DeliveryScheduleFilters, UploadDeliveryScheduleModal, EditDeliveryScheduleModal, DeleteDeliveryScheduleModal, DeliveryStatisticsSummary, DeliveryStatisticsChart, DeliveryDailyBreakdownTable, QuickFilterButtons | S |
| FE-02 | Xóa FE page + API | Xóa: `DeliverySchedulePage.tsx`, `deliveryScheduleApi.ts` | XS |
| FE-03 | Sửa Router.tsx | Remove `import DeliverySchedulePage` + `<Route path="/vehicle-data/delivery-schedule" ...>` | XS |
| FE-04 | Sửa MainLayout.tsx | Remove sidebar item `{ to: '/vehicle-data/delivery-schedule', ... }` | XS |
| FE-05 | Sửa AuditLogPage.tsx | Remove `delivery_schedule: 'Lịch đi hàng'` từ label map | XS |
| FE-06 | Sửa Dashboard Operations tab | Thay đổi tab Vận tải: remove chart/table dùng `delivery_schedules` data, chỉ giữ `driver_invoices` stats. Update type `OperationsData` trong `frontend/src/types/dashboard.ts`. | M |
| FE-07 | Sửa Dashboard Overview tab | Remove `trip_count` KPI card khỏi Overview tab (nếu có). Update type `OverviewData`. | S |
| FE-08 | Lint + Typecheck FE | `npm run lint && npm run typecheck` | XS |

## 🧪 QA TASKS

| ID | Task | Chi tiết kỹ thuật | Effort |
|----|------|-------------------|--------|
| QA-01 | Test Dashboard | Verify Overview tab không còn trip_count. Verify Operations tab chỉ hiển thị driver_invoices stats. Check console không có errors. | S |
| QA-02 | Test Sidebar + Routes | Verify sidebar không còn "Lịch đi hàng". Verify `/vehicle-data/delivery-schedule` redirect về `/`. | S |

## 📝 DOCS TASKS

| ID | Task | Chi tiết kỹ thuật | Effort |
|----|------|-------------------|--------|
| DOC-01 | Update system-features.md | Remove section "Lịch đi hàng" (nếu có). Update Dashboard section. | S |
| DOC-02 | Update know-how.md | Remove `delivery_schedules` schema + API endpoints. | S |
| DOC-03 | Update lessons-learned.md | Ghi nhận change: xóa feature Lịch đi hàng. | XS |

---

## 📊 Thứ tự thực hiện

Phase 3: BE-01 → BE-02 → BE-03 → BE-04 → BE-05
Phase 4: Run migration (BE-04)
Phase 5: QA-01 (BE only)
Phase 6: FE-01 → FE-02 → FE-03 → FE-04 → FE-05 → FE-06 → FE-07 → FE-08
Phase 7: QA-02 (FE regression)
Phase 8: DOC-01 → DOC-02 → DOC-03

## ⚠️ Lưu ý kỹ thuật

- **Backup data trước khi DROP:** Chạy `SELECT COUNT(*) FROM delivery_schedules` trước để biết số records. Nếu cần backup: `COPY delivery_schedules TO '/tmp/delivery_schedules_backup.csv' CSV HEADER;`
- **Dashboard Operations tab:** Hiện tại có 4 queries trong Promise.all — 3 queries dùng `delivery_schedules`, 1 query dùng `driver_invoices`. Sau khi xóa, chỉ còn 1 query `driver_invoices`. Cần update cả type `OperationsData` ở BE và FE.
- **Dashboard Overview tab:** `trip_count` nằm trong KPI query đầu tiên — cần remove field này khỏi query result + type.
- **Audit log cũ:** Các log có `entity_type = 'delivery_schedule'` vẫn hiển thị, chỉ mất label → fallback về raw string. Không cần migration cho audit_logs.
- **Không xóa migrations cũ (010, 011):** Giữ lại để lịch sử migration không bị gap. Migration mới (0XX) sẽ DROP TABLE.
