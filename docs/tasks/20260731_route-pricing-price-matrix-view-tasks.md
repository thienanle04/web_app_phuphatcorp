# Task List: Tab Bảng giá (ma trận theo kỳ)

**Ngày:** 2026-07-31  
**BA Doc:** `docs/ba/20260731_route-pricing-price-matrix-view-analysis.md`  
**UI Spec:** `docs/ui/20260731_route-pricing-price-matrix-view-ui-spec.md`  
**Layout:** `docs/ui/20260731_route-pricing-price-matrix-layout.md`

---

## Backend Tasks

| ID | Task | Chi tiết kỹ thuật | Effort |
|----|------|-------------------|--------|
| BE-01 | Types matrix response | Thêm types trong `backend/src/types/routePricing.ts`: `PriceMatrixResponse`, `WeightTable`, `WeightColumn`, `WeightRow`, `TripsMatrixRow`. Không migration. | S |
| BE-02 | Service `getPriceMatrix` | `routePricingService.getPriceMatrix(supplierId)`: load periods ASC; load active groups + absolute version + all versions JOIN periods; group `by_weight` by schema fingerprint từ absolute tiers; build `weight_tables[]` (columns = tiers + pallet cuối; cells[periodId][colKey]); build `trips.rows` (chỉ bậc chuyến / nhóm, không pallet); sort tables theo BA. | L |
| BE-03 | Helpers schema / labels | Helper: `tierSchemaKey`, `tierColumnKey`, `formatWeightColumnLabel` / `schema_label`, `formatTripsLabel` (reuse logic FE formatTonRange nếu cần mirror). | M |
| BE-04 | Controller + validation + route | `GET /route-pricing/prices/matrix?supplier_id=` — query int ≥1; `route_pricing.view`; `listPrices` route đặt **trước** param routes nếu cần tránh conflict (path tĩnh `/prices/matrix`). | S |
| BE-05 | Unit tests | `routePricingService.test.ts`: schema grouping (2 fingerprints → 2 tables); pallet column last (weight); trips không pallet; single open trips tier OK; empty supplier groups. | M |

## Frontend Tasks

| ID | Task | Chi tiết kỹ thuật | Effort |
|----|------|-------------------|--------|
| FE-01 | API + hook | `routePricingApi.getPriceMatrix(supplierId)`; `usePriceMatrix(supplierId)` queryKey `['route-pricing','prices-matrix', id]`. | S |
| FE-02 | Tab shell rename | `TabKey`: `prices` = matrix, `manage` = old PricesTab; nav labels **Bảng giá** / **Quản lý giá**; deep-link từ Nhóm tuyến → `tab=manage&groupId=`. | S |
| FE-03 | `PriceMatrixWeightTable` | Props: periods, columns, rows, schema_label. Thead 3 tầng; sticky STT+Tuyến; format số; null trống; pallet cuối. | L |
| FE-04 | `PriceMatrixTripsTable` | Props: periods, rows. Cột STT\|Tuyến\|Số chuyến\|kỳ…; sticky; ẩn nếu rows=[]. | M |
| FE-05 | `PriceMatrixTab` | Empty NCC / periods / no data; map `weight_tables`; section titles; gắn vào page khi `tab=prices`. | M |
| FE-06 | Docs know-how | Cập nhật `.agents/knowhow/know-how.md` + `system-features.md` (và `.opencode` mirror nếu đang sync): endpoint matrix + tab rename. | S |

## Thứ tự thực hiện

```
BE-01 → BE-03 → BE-02 → BE-04 → BE-05
FE-01 → FE-02 → FE-03 → FE-04 → FE-05 → FE-06
```

QA: đối chiếu UI Spec + BA acceptance; regression tab Quản lý giá / Kỳ / Nhóm.

## Coding Standards

Đọc `.agents/knowhow/coding-convention.md` trước khi code. FE đọc UI Spec trước khi layout.

## Lưu ý kỹ thuật

- **Không migration** — chỉ read aggregate.
- Route `GET /prices/matrix` phải đăng ký trước `GET /prices/:configId/versions` nếu Express match nhầm `matrix` = configId (hoặc dùng path rõ `/prices/matrix`).
- Schema fingerprint chỉ từ **absolute** `by_weight`; cascade thiếu bậc → `null`.
- Nhóm chưa có giá: **không** đưa vào matrix (A10).
- Period header: `formatDate` + `formatPercentLabel` + note; màu xen kẽ amber/lime (dark-safe).
- Reuse `formatTonRange` / trips label từ `RoutePricingPage` — cân nhắc extract shared util nếu duplicate.
