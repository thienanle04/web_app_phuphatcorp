# Task List: Route pricing — sửa giá theo kỳ (manual adjust)

**Ngày:** 2026-09-15  
**BA Doc:** `docs/ba/20260915_route-pricing-period-manual-adjust-analysis.md`  
**UI Spec:** `docs/ui/20260915_route-pricing-period-manual-adjust-ui-spec.md`  
**Knowhow:** `.opencode/knowhow/know-how.md`, `.opencode/knowhow/system-features.md`

---

## ⚙️ BACKEND TASKS

| ID | Task | Chi tiết kỹ thuật | Effort |
|----|------|-------------------|--------|
| BE-01 | Migration 046 | File `backend/src/migrations/046_route_pricing_manual_adjust.sql`, idempotent. (1) `ALTER TABLE route_price_versions ADD COLUMN IF NOT EXISTS pallet_manual_adjusted BOOLEAN NOT NULL DEFAULT FALSE`. (2) `ALTER TABLE route_price_tiers ADD COLUMN IF NOT EXISTS is_manual_adjusted BOOLEAN NOT NULL DEFAULT FALSE`. | S |
| BE-02 | Types | `backend/src/types/routePricing.ts`: `RoutePriceVersion.pallet_manual_adjusted: boolean`; `RoutePriceTier.is_manual_adjusted: boolean`. Matrix cell type: `{ value: number \| null; manual_adjusted: boolean }` (weight/truck period cells + trips cells). Cập nhật type `PriceMatrix*` cho khớp. | S |
| BE-03 | Validate giá ≥ 0 | `validateTiers`: mọi mode đổi `price > 0` → `price >= 0` (finite, không NaN). Pallet giữ `>= 0`. `createAbsolute` / `updateAbsolute` / insert cascade: tier mới `is_manual_adjusted=false`, version mới `pallet_manual_adjusted=false`. | S |
| BE-04 | `updateAbsolute` preserve dấu | Trước khi overwrite absolute: snapshot giá pallet + map fingerprint→{price, flag}. Sau insert tiers mới: set `is_manual_adjusted` / `pallet_manual_adjusted` chỉ khi giá **không đổi** so với snapshot; bậc mới / giá đổi → `false`. Kỳ sau delete+rebuild: mọi flag `false` (như insertScaled). | M |
| BE-05 | Service `manualAdjustVersion` | Method mới trên `routePricingService`: input `versionId`, `{ pallet_trip_price, tiers: { id, price }[] }`, `userId`. Transaction: lock version + config; validate đủ đúng tập tier ids; diff ô đổi; UPDATE kỳ hiện tại + set flag `true` trên ô đổi; load later periods cùng `price_config` `start_date >` kỳ hiện ASC; với mỗi ô đổi scale `roundToThousands(prev*(1+%/100))`, khớp bậc bằng `weightTierColumnKey` / trips range / `truckTierColumnKey` / pallet; UPDATE giá + `is_manual_adjusted=false` (pallet tương ứng); ô không đổi không UPDATE. **Không** delete/recreate version. Return version đã sửa + tiers. | L |
| BE-06 | Matrix + versions response | `loadTiers` / `mapVersionRow` map flags. `getPriceMatrix`: mọi `periodCells[col]` và trips `cells[period]` trả `{ value, manual_adjusted }` (null value khi thiếu version/ô). | M |
| BE-07 | Controller + route + validation | `PUT /route-pricing/prices/versions/:versionId/manual-adjust`, permission manage. Express validators: `versionId` int; `pallet_trip_price` float min 0; `tiers` array min 1; `tiers.*.id` int; `tiers.*.price` float min 0. Đồng thời sửa `priceCreateSchema` / `priceUpdateAbsoluteSchema`: `tiers.*.price` `min: 0` (bỏ `gt: 0`). | M |
| BE-08 | Unit tests | `routePricingService.test.ts`: price = 0 OK; price < 0 reject; manual-adjust 1 bậc mid-period cascade + làm tròn; chỉ ô đổi bị scale; kỳ sau mất flag; absolute preserve flag khi giá không đổi / clear khi đổi; matrix cell shape `{value, manual_adjusted}`; regression create period / delete period / truck+weight+trips. | L |

## 🎨 FRONTEND TASKS

| ID | Task | Chi tiết kỹ thuật | Effort |
|----|------|-------------------|--------|
| FE-01 | Types + API + hooks | `routePricingApi.ts` / hooks: types flags + matrix cell object; `manualAdjustVersion(versionId, body)`; `useManualAdjustPrice` mutation invalidate `prices`, `prices-matrix`, versions. | S |
| FE-02 | `formatPriceCell` + card dấu | Helper `0 → '-'`, null/empty. `PriceVersionCard`: Pencil `aria-label` (manage); giá `-`; `*`/icon + title “Đã điều chỉnh”; Pallet 0 + flag → badge **"Pallet được điều chỉnh về 0"** + `-`; Pallet 0 !flag → ẩn dòng. | M |
| FE-03 | `PeriodPriceAdjustModal` | File mới (khuyến nghị): prefill Pallet + bậc (nhãn/đơn vị RO, chỉ giá); dirty compare; validate ≥ 0; Lưu disabled nếu !dirty; Lưu → mở confirm (chưa API). | M |
| FE-04 | `PeriodPriceAdjustConfirmModal` | List ô đổi cũ→mới (số `0` hiện `0`); list ngày kỳ sau; chú thích mất dấu; Hủy / Xác nhận → mutation; submitting spinner. | M |
| FE-05 | Wire Quản lý giá | `PricesTab` / card: mở adjust modal theo version; sau success toast + đóng. | S |
| FE-06 | `PriceFormModal` absolute | Cho giá bậc ≥ 0 (client validate khớp BE); không thêm confirm mất dấu. | S |
| FE-07 | `PriceMatrixTab` | Đọc `{ value, manual_adjusted }`; `0 → '-'`; highlight nền khi `manual_adjusted`; pallet 0+flag `title` badge chữ; không nút sửa. | M |
| FE-08 | i18n | Keys UI Spec §5 trong `vi.json` + `en.json`. | S |

## 🧪 QA TASKS

| ID | Task | Chi tiết | Effort |
|----|------|----------|--------|
| QA-01 | Unit/integration BE | Cover UC-1…UC-8 BA; đồng bộ BE-08 | M |
| QA-02 | Regression UI | Đối chiếu UI Spec screens A–E; dirty/disable; confirm; matrix highlight; view-only không Pencil | M |

## 📊 Thứ tự thực hiện

```
Phase 3:  BE-01 → BE-02 → BE-03 → BE-04 → BE-05 → BE-06 → BE-07  (lint + build sau mỗi task)
Phase 4:  Migration 046 (`npm run db:push` / runner dự án)
Phase 5:  BE-08 / QA-01
Phase 6:  npm run test  (3 lần fail → dừng)
Phase 7:  FE-01 → FE-02 → FE-03 → FE-04 → FE-05 → FE-06 → FE-07 → FE-08  (đọc UI Spec trước layout)
Phase 8:  QA-02 regression
Phase 9–10: Cập nhật know-how.md + system-features.md (endpoint, cột flag, cell matrix shape, BR-MA)
```

## Coding Standards

Đọc `.agents/knowhow/coding-convention.md` (hoặc `.opencode/knowhow`) trước khi code. Envelope `{ success, message, data }`. Migration idempotent. FE không tự invent layout — UI Spec. Graphify update sau khi sửa code.

## ⚠️ Lưu ý kỹ thuật

- **Breaking** matrix cells: FE+BE cùng release; cập nhật mọi consumer `formatMoney(row.cells…)`.
- Manual-adjust **cấm** `deleteVersionsByIds` — khác `updateAbsolute`.
- Diff số bằng `Number` so sánh; không coi dirty nếu user gõ lại đúng giá cũ.
- Khớp bậc kỳ sau: reuse `weightTierColumnKey` / `truckTierColumnKey` / trips `(from,to)`; thiếu bậc → skip ô, không fail cả TX.
- Confirm list kỳ sau: FE derive từ `versions` đã load (không cần preview API).
- Sửa gốc không confirm mất dấu (A11) — đừng “cải thiện” thêm confirm.
- `created_by` trên version không đổi khi manual-adjust (ghi đè tại chỗ); không yêu cầu cột `updated_by` mới trừ khi đã có sẵn trên bảng (hiện version không có updated_by — không thêm trừ BA yêu cầu).
