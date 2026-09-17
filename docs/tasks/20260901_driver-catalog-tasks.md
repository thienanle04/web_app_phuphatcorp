# Task List: Danh mục tài xế (Driver Catalog)

**Ngày:** 2026-09-01
**BA Doc:** docs/ba/20260901_driver-catalog-analysis.md
**UI Spec:** docs/ui/20260901_driver-catalog-ui-spec.md

---

## ⚙️ BACKEND TASKS

| ID | Task | Chi tiết kỹ thuật | Effort |
|---|---|---|---|
| BE-01 | Migration | `036_create_drivers_and_driver_vehicles.sql`: Bảng `drivers` + `driver_vehicles` | S |
| BE-02 | Service | `driverService.ts`: CRUD, getAvailableUsers, getAvailableVehicles ('Xe nhà'), toggleStatus | M |
| BE-03 | Controller & Validation | `driverController.ts`: handlers + Zod / express-validator schema | M |
| BE-04 | Route | `routes/drivers.ts` + đăng ký vào `routes/index.ts` | S |

## 🎨 FRONTEND TASKS

| ID | Task | Chi tiết kỹ thuật | Effort |
|---|---|---|---|
| FE-01 | API & Hook | `api/driverApi.ts` & `hooks/useDrivers.ts` | S |
| FE-02 | Form Modal | `components/catalog/DriverFormModal.tsx`: dropdown User, Multi-select/Tags Xe nhà | M |
| FE-03 | Page | `pages/admin/catalog/DriverCatalogPage.tsx`: Bảng danh sách, filter, pagination, toggle | M |
| FE-04 | Routing & Sidebar & i18n | `Router.tsx`, `MainLayout.tsx`, `vi.json`, `en.json` | S |
