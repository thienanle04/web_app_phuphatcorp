# Task List: Bộ giá (price sets)

**Ngày:** 2026-09-17
**BA Doc:** `docs/ba/20260917_route-pricing-price-sets-analysis.md`
**UI Spec:** `docs/ui/20260917_route-pricing-price-sets-ui-spec.md`
**Knowhow:** `.opencode/knowhow/know-how.md`, `.opencode/knowhow/system-features.md`, `.opencode/knowhow/decisions.md`

---

## BACKEND TASKS

| ID | Task | Chi tiết kỹ thuật | Effort |
|----|------|-------------------|--------|
| BE-01 | Migration `055_route_pricing_price_sets.sql` | Idempotent, schema only. (1) `price_sets` (`name`, `pricing_mode`, `has_pallet`, `fingerprint TEXT NOT NULL`, `status`, audit) + unique `lower(trim(name))` và unique `fingerprint` khi active. (2) `price_set_tiers`. (3) `route_price_configs.price_set_id` NULL FK. (4) `route_price_tiers.price_set_tier_id` NOT NULL FK; còn dòng bậc giá thì fail, không backfill, không xóa. (5) `pallet_trip_price` cho phép NULL; không `UPDATE` `0` thành NULL. Không seed catalog. Không drop cột range/label cũ. | L |
| BE-02 | Types | `backend/src/types/routePricing.ts`: `PriceSet`, `PriceSetTier`; config summary có `price_set_id` và `price_set_name`; tier có `price_set_tier_id`; `pallet_trip_price` nullable; matrix table có `price_set_id`, `schema_label` = tên bộ. | S |
| BE-03 | Service catalog bộ giá | `listPriceSets`, `createPriceSet`, `renamePriceSet`, `addPriceSetTier`, `replacePriceSetStructure` (chỉ khi chưa có nhóm), `deactivatePriceSet`. Check fingerprint trùng và tập con, kể cả khi thêm bậc làm bộ khác thành tập con. Bộ đang gắn: cấm sửa bậc cũ, xóa, deactive (`PRICE_SET_IN_USE`). Tên trùng `PRICE_SET_NAME_DUPLICATE`. | L |
| BE-04 | Gắn giá vào bộ | `createPrice` / `updateAbsolutePrice` bắt `price_set_id`. Mode lấy từ bộ. Tiers `{ price_set_tier_id, price }` với `price > 0`. Ô không gửi = không insert. Pallet NULL nếu không gửi. `PALLET_NOT_IN_SET` nếu bộ không có pallet. `PRICE_NOT_POSITIVE` nếu không còn bậc nào và pallet null. Đổi bộ khi đã có version → `PRICE_SET_LOCKED`. Cascade chỉ scale bậc còn record. `deleteGroupPrices` xóa version, `price_set_id = NULL`, không đụng nhóm tuyến. Manual adjust kỳ lẻ sửa bậc đã có record và nhận `added_tiers` cho bậc bộ chưa có trên kỳ đó; không xóa bậc đã có; kỳ sau insert giá scale. `insertTiers` ghi `price_set_tier_id`; range/label copy từ bộ để CHECK cũ không gãy. Nguồn sự thật là `price_set_tiers`. | L |
| BE-05 | Ma trận theo bộ | Một bảng mỗi `price_set_id` có nhóm trong book. Cột = bậc cộng pallet cuối nếu có nhóm có giá ở bất kỳ kỳ. Ô thiếu `null`, không `0`. Trips cùng shape một dòng một nhóm. `trips.rows` để rỗng. Thứ tự weight, truck, trips, rồi tên bộ. Không tách fingerprint bằng `mergeCompatibleWeightBuckets`. | M |
| BE-06 | Route + validation | Express-validator, không Zod. GET/POST `/price-sets`, PUT `/price-sets/:id`, POST `/price-sets/:id/tiers`, DELETE `/price-sets/:id`. DELETE `/prices/groups/:routeGroupId`. Sửa schema POST prices và PUT absolute. Map mã lỗi BA §7. Lookup không đụng. | M |

## FRONTEND TASKS

| ID | Task | Chi tiết kỹ thuật | Effort |
|----|------|-------------------|--------|
| FE-01 | API + hooks + types | `routePricingApi.ts`, `useRoutePricing.ts`: CRUD bộ giá, xóa giá nhóm, body giá `{ price_set_id, tiers, pallet_trip_price }`. Types khớp BE. | M |
| FE-02 | Tab Bộ giá | `PriceSetsTab.tsx` + `PriceSetFormModal.tsx` theo UI Spec Screen 1–4. Route `/route-pricing/sets` (không `?tab=sets`). Không cần chọn bảng giá. Loading, empty, error. Icon `aria-label`. Confirm xóa. Đổi mode và hủy modal tạo bộ không confirm. | L |
| FE-03 | Modal giá nhóm | Sửa `PriceFormModal`: bỏ radio mode và thêm/xóa bậc. Select bộ active; lúc sửa thì disabled. Dòng = bậc bộ, thêm pallet nếu bộ có. Ô trống hợp lệ. Giá `0` báo inline. Confirm recascade khi sửa. | L |
| FE-04 | Card + điều chỉnh kỳ | Card hiện tên bộ. Nút “Xóa giá” + confirm. Modal điều chỉnh kỳ hiện đủ bậc bộ: bậc đã có không xóa trắng; bậc chưa có để trống hoặc nhập `> 0` để áp dụng từ kỳ đó (kỳ sau scale %). Copy đúng UI Spec Screen 6. | M |
| FE-05 | Ma trận | Một section một bộ, tiêu đề là tên bộ. Cột đã lọc từ API. Ô null hiện `-`. Bỏ view trips một-dòng-một-bậc. Giữ scroll container, không `content-visibility`. Giữ “Từ kỳ”, sticky, màu kỳ. | M |
| FE-06 | i18n | Thêm key UI Spec §5 vào `vi.json` và `en.json`. Không hardcode string mới. | S |

## Thứ tự thực hiện

```
Phase 3:  BE-01 → BE-02 → BE-03 → BE-04 → BE-05 → BE-06   (lint + build sau mỗi task)
Phase 4:  cd backend && npm run migrate
Phase 5:  test-qa viết unit (tập con, cấm 0, xóa giá, ma trận ẩn cột, lookup vẫn 501)
Phase 6:  cd backend && npm test   (3 lần fail → dừng)
Phase 7:  FE-01 → FE-02 → FE-03 → FE-04 → FE-05 → FE-06  (đọc UI Spec trước)
Phase 8:  QA regression đối chiếu UI Spec
Phase 9–10: đã cập nhật `.opencode/knowhow/know-how.md`, `system-features.md`, `decisions.md`
```

## Coding Standards

Đọc `.opencode/knowhow/coding-convention.md` trước khi code. Envelope `{ success, message, data }`. Migration `IF NOT EXISTS` / `IF EXISTS`. FE không tự quyết layout.

## Lưu ý kỹ thuật

- Route pricing đang dùng express-validator. Không chuyển Zod trong CR này.
- File `055_…` không đụng migration đã chạy. Folder có số trùng (`046` lặp) nhưng runner sort theo tên.
- Cột range/label trên `route_price_tiers` chỉ copy từ bộ. API không nhận range từ client.
- Migration không đổi pallet `0` cũ. App cấm lưu `0` mới.
- Sửa giá gốc đang xóa và tạo lại kỳ sau. Bỏ bậc trên gốc thì kỳ sau mất bậc đó và mất cờ chỉnh tay. UI phải confirm.
- Bộ tấn không pallet nhưng trùng 5 bậc của `Tấn chuẩn + Pallet` là tập con → 400. Pallet là một slot trong fingerprint.
- Lookup `LOOKUP_DEFERRED` giữ nguyên. Không sửa Delivery Import, không sửa seed F-sheet.
- Ma trận ẩn cột theo book đang xem, không theo toàn hệ thống.
- Confirm destructive dùng `window.confirm` nếu page chưa có dialog riêng. Copy đúng UI Spec.
