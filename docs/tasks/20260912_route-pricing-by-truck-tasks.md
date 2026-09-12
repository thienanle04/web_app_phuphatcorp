# Task List: Route pricing — mode `by_truck`

**Ngày:** 2026-09-12  
**BA Doc:** `docs/ba/20260912_route-pricing-by-truck-analysis.md`  
**UI Spec:** `docs/ui/20260912_route-pricing-by-truck-ui-spec.md`  
**Knowhow:** `.opencode/knowhow/know-how.md`, `.opencode/knowhow/system-features.md` (mirror `.cursor/knowhow` nếu có)

---

## ⚙️ BACKEND TASKS

| ID | Task | Chi tiết kỹ thuật | Effort |
|----|------|-------------------|--------|
| BE-01 | Migration 045 | File `backend/src/migrations/045_route_pricing_by_truck.sql`, idempotent. (1) `ALTER TABLE route_price_versions DROP CONSTRAINT IF EXISTS route_price_versions_pricing_mode_check` rồi `ADD CONSTRAINT ... CHECK (pricing_mode IN ('by_weight','by_trips','by_truck'))`. (2) `ALTER TABLE route_price_tiers ADD COLUMN IF NOT EXISTS label VARCHAR(255) NULL`. Không unique index trên label. | S |
| BE-02 | Types | `backend/src/types/routePricing.ts`: `PricingMode` thêm `'by_truck'`; `RoutePriceTier.label?: string \| null`; `PriceMatrixWeightColumn.kind` thêm `'truck'`; `PriceMatrixResponse.truck_tables: PriceMatrixWeightTable[]` (default `[]`). | S |
| BE-03 | Parse + validate + insert | `routePricingService.ts`: `parsePricingMode` nhận `by_truck`. `validateTiers`: nhánh truck — ≥1 bậc; `label` trim length 1–255; unique nguyên chuỗi sau trim; `pricing_unit` chuyen\|tan; `price > 0`; cấm `min_billable_ton` > 0; **không** overlap/range. `insertTiers`: truck → `label` trim, `range_from=0`, `range_to=null`, `min_billable_ton=null`. Weight/trips: `label=null`, logic cũ. `mapVersionRow`/`loadTiers` map `label`. `scaleTiers` giữ `label`. | M |
| BE-04 | Ma trận `truck_tables` | `getPriceMatrix`: nhóm absolute `by_truck` theo `truckSchemaKey` = join `sort_order` các `t:{label}:{unit}` — **không** sort `range_from`, **không** `mergeCompatibleWeightBuckets`. Build `truck_tables[]` cùng shape weight (Pallet cuối, `kind: 'truck'`). Sort bảng: `rows.length` DESC, `schema_key` ASC. Return thêm `truck_tables` (weight/trips không đổi). Export helper `truckTierColumnKey` / `truckSchemaKey` cho test. | M |
| BE-05 | Controller/API | Không route mới. Body POST `/prices` và PUT `.../absolute` đã forward `pricing_mode` + `tiers`; đảm bảo `label` không bị strip. Lookup **không** đụng. | S |
| BE-06 | Unit tests | `routePricingService.test.ts`: parse mode; create truck OK (mix đơn vị, `≤` vs `<=` hai bậc); reject nhãn rỗng/trùng/giá ≤0/min_billable; cascade copy label+unit+order; `truckSchemaKey` thứ tự form; hai schema khác chính tả không merge; `getPriceMatrix` (nếu test integration/service có fixture) `truck_tables` tách khỏi `weight_tables`. Regression weight overlap + trips chain + lookup deferred. | M |

## 🎨 FRONTEND TASKS

| ID | Task | Chi tiết kỹ thuật | Effort |
|----|------|-------------------|--------|
| FE-01 | Types + API + hooks | `frontend/src/api/routePricingApi.ts` + `useRoutePricing.ts`: `PricingMode` + `label` trên tier; `truck_tables` trên matrix; mutation body gửi `label` khi `by_truck` (không gửi range/min). Copy types khớp BE. | S |
| FE-02 | `PriceFormModal` | `RoutePricingPage.tsx`: radio **Theo loại xe**; `switchMode('by_truck')` → 1 dòng `{ label:'', pricing_unit:'chuyen', price:0 }`; hint UI Spec; hàng: Input nhãn (`spellCheck={false}`, placeholder `vd. Truck 0,5mt…`) + Select đơn vị + giá; 🗑 `aria-label="Xóa bậc"` disable khi 1 dòng; `+ Thêm bậc`. Weight/trips không đổi. Confirm copy giữ nguyên. | M |
| FE-03 | `PriceVersionCard` | Badge `Theo loại xe`; bảng cột Loại xe / Đơn vị / Đơn giá; `break-words` nhãn; không hiện `range_from`. Pallet 0 ẩn như cũ. | S |
| FE-04 | `PriceMatrixTab` | Section **Theo loại xe** giữa weight và trips khi `truck_tables.length > 0`. Tái dụng table 3 tầng; `kind === 'truck'` header `break-words`/`max-w`; cùng `visiblePeriods`. Không empty-state giả. | M |
| FE-05 | Copy VI | Hardcode theo UI Spec §5 (không i18n framework). Dấu `…`. | S |

## 📊 Thứ tự thực hiện

```
Phase 3:  BE-01 → BE-02 → BE-03 → BE-04 → BE-05   (lint + build sau mỗi task)
Phase 4:  Migration 045 (`npm run db:push` / runner dự án)
Phase 5:  BE-06 (test-qa viết)
Phase 6:  npm run test  (3 lần fail → dừng)
Phase 7:  FE-01 → FE-02 → FE-03 → FE-04 → FE-05  (đọc UI Spec trước layout)
Phase 8:  QA regression đối chiếu UI Spec + UC BA
Phase 9–10: Cập nhật know-how.md + system-features.md (`pricing_mode`, cột `label`, `truck_tables`)
```

## Coding Standards

Đọc `.cursor/knowhow/coding-convention.md` (hoặc `.opencode/knowhow`) trước khi code. Envelope `{ success, message, data }`. Migration `IF NOT EXISTS` / `IF EXISTS`. FE: không tự invent layout — UI Spec.

## ⚠️ Lưu ý kỹ thuật

- **Không** `match_kind` / inclusive / parse bất đẳng thức. Identity = text trim.
- Placeholder `range_from=0` **cấm** lộ UI (card/matrix/form truck).
- Fingerprint truck **không** reuse `tierSchemaKey` (hàm đó sort `range_from` + merge subset).
- Tên CHECK Postgres mặc định thường là `route_price_versions_pricing_mode_check` — verify `\d` nếu DROP miss.
- `chk_rpt_min_billable` đã cho `tan` + min NULL — truck tấn OK.
- Client cũ: thêm `truck_tables` không breaking; `kind: 'truck'` chỉ trên bảng mới.
- Lookup / seed F / Delivery Import: **cấm** scope creep.
- Confirm đổi mode: `window.confirm` hiện tại, không modal mới.
