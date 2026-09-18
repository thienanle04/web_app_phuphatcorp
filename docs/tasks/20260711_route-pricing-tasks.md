# Task List: Tính giá theo tuyến đường (Route Pricing)

**Ngày:** 2026-07-11  
**Cập nhật:** 2026-07-13  
**BA Doc:** docs/ba/20260711_route-pricing-analysis.md  
**BA CR:** docs/ba/20260712_route-pricing-change-request.md  
**UI Spec:** docs/ui/20260711_route-pricing-ui-spec.md  
**Module:** `route_pricing` (permission + sidebar riêng — không thuộc `accounting_data`)

**Status tổng:** v1 + CR location/note/trips **DONE**. UI bảng giá 3 cột (`≤ 2.5 tấn` / `>8-16`). QA regression còn mở.

---

## ⚙️ BACKEND TASKS

| ID | Task | Chi tiết kỹ thuật | Effort | Status |
|----|------|-------------------|--------|--------|
| BE-01 | Migration master Tỉnh/Phường | `033_create_vn_provinces_wards.sql` + script `import-vn-provinces.ts` (`npm run import:vn-provinces`). Master 2 cấp provinces/wards. | L | ✅ Done |
| BE-02 | Migration schema Route Pricing | `034_create_route_pricing.sql` — delivery_routes, route_groups (+ is_residual), members, configs, versions, tiers. | M | ✅ Done |
| BE-03 | Seed permissions | `035_seed_route_pricing_permissions.sql` — `route_pricing.view` / `.manage`. | S | ✅ Done |
| BE-04 | Types | `backend/src/types/routePricing.ts` | S | ✅ Done |
| BE-05 | Service geo | `listProvinces`, `listWards` trong `routePricingService` | S | ✅ Done |
| BE-06 | Service routes | CRUD + unique active; vẫn dùng nội bộ khi tạo nhóm có phường (không còn tab FE). | M | ✅ Done |
| BE-07 | Service groups | Có ward → INSERT routes; không ward → residual; tên server-side. | L | ✅ Done |
| BE-08 | Service prices | Absolute lần đầu; adjust % global + `toDateOnly` (tránh `String(Date).slice` → `"Thu Apr 16"`); round hàng nghìn. | L | ✅ Done |
| BE-09 | Service lookup | BR-005b member → residual → not found. | M | ✅ Done |
| BE-10 | Validation schemas | Controllers/express-validator. | M | ✅ Done |
| BE-11 | Controllers + routes | `/api/route-pricing` wired in `routes/index.ts`. | M | ✅ Done |
| BE-12 | Unit tests | `backend/src/__tests__/routePricingService.test.ts` | M | ✅ Done |

**Apply migrations:** `backend/src/scripts/apply-route-pricing-migrations.ts` (nếu full migrate fail trên migration cũ).

---

## 🎨 FRONTEND TASKS

| ID | Task | Chi tiết kỹ thuật | Effort | Status |
|----|------|-------------------|--------|--------|
| FE-01 | API module | `frontend/src/api/routePricingApi.ts` — geo, routes, groups, prices, versions, adjust, lookup. | S | ✅ Done |
| FE-02 | Hooks | `hooks/useRoutePricing.ts` — + `usePriceVersions(configId)`. | M | ✅ Done |
| FE-03 | Page shell | `RoutePricingPage.tsx` — **2 tabs** (Nhóm tuyến \| Bảng giá); **auto-select NCC** (mã nhỏ nhất); **không** link Catalog; URL `?supplierId=&tab=&groupId=`; UI tiếng Việt. | M | ✅ Done |
| FE-04 | RoutesTab | ~~Tab Tuyến đường~~ — **đã bỏ** khỏi UI (tuyến chỉ sinh khi tạo/sửa nhóm). | — | ❌ Cancelled |
| FE-05 | GroupsTab + GroupFormModal | Search **accent-insensitive** (không search chuỗi UI residual); filter tỉnh; click row → `tab=prices&groupId=`; modal search phường không dấu; tên nhóm read-only. | M | ✅ Done |
| FE-06 | PricesTab + history + modals | `SearchableSelect` nhóm (label = tên nhóm, không append tỉnh); **hiện đủ lịch sử** phiên bản (`listVersions`); Chuyến ẩn Từ/Đến/Min; nhãn **Tối thiểu (tấn)**; `PriceAdjustModal` size lg; bảng/card nền trắng. | L | ✅ Done |
| FE-07 | Router + sidebar | `/route-pricing`, sidebar top-level `Giá theo tuyến`. | S | ✅ Done |
| FE-08 | i18n | Copy hardcoded tiếng Việt trên page (pattern catalog pages); keys UI Spec §5 optional. | S | ⚠️ Partial (hardcoded VI) |
| FE-09 | Delivery Import lookup | `processDeliveryData.ts` gọi `GET /api/route-pricing/lookup` thay hardcode khung giá. | L | ✅ Done |

### FE polish (cùng đợt 2026-07-12)

| ID | Task | Chi tiết | Status |
|----|------|----------|--------|
| FE-10 | DateInput portal | Calendar via `createPortal`; `ChevronsLeft/Right` năm; focus ring nhẹ. | ✅ Done |
| FE-11 | Select / Input focus | `ring-1` xám thay `ring-2` + `border-transparent`. | ✅ Done |
| FE-12 | SearchableSelect | `components/ui/SearchableSelect.tsx` — search không dấu, portal dropdown. | ✅ Done |

---

## 🧪 QA TASKS

| ID | Task | Chi tiết | Effort | Status |
|----|------|----------|--------|--------|
| QA-01 | API tests | Cover AC + error codes; unit service đã có. | M | ⚠️ Partial |
| QA-02 | FE regression | UI Spec cập nhật: 2 tabs, history giá, SearchableSelect, residual search không khớp “khác”, DateInput trong modal. | M | ⬜ Todo |

---

## 📊 Thứ tự thực hiện (đã chạy)

```
✅ Phase 3–4:  BE-01…BE-12 + migrations 033–035 + import VN provinces
✅ Phase 5–6:  Unit tests service (QA-01 partial)
✅ Phase 7:    FE-01…FE-03, FE-05…FE-07, FE-09 (+ FE-10…12 polish); FE-04 cancelled
⬜ Phase 8:    QA-02 regression vs UI Spec
✅ Phase 9–10: know-how.md + system-features.md (đồng bộ)
```

---

## Coding Standards

Đọc `.agents/knowhow/` trước khi code. Response `{ success, message, data }`. Soft-delete `status` active/deactive. UI copy tiếng Việt; docs thuật ngữ lẫn Anh/Việt OK.

---

## ⚠️ Lưu ý kỹ thuật

1. **Permission riêng:** `route_pricing.*` — user cần **re-login** sau seed.
2. **Không tái dùng tuyến:** create group có ward luôn INSERT route mới.
3. **Residual:** `ward_codes` rỗng → `is_residual`; max 1 / (supplier, province).
4. **Tên nhóm:** chỉ server; body không có `name`.
5. **Round %:** `Math.round(raw/1000)*1000` — `NUMERIC(15,0)`.
6. **DATE serialize:** luôn `toDateOnly(Date)` — không `String(date).slice(0,10)`.
7. **FE search residual:** không đưa chuỗi “Phường chưa thuộc nhóm khác” vào haystack (`ha` ⊂ `khac`).
8. **Adjust %:** toàn hệ thống; API không nhận `supplier_id`.
9. **UI tabs:** chỉ Nhóm tuyến + Bảng giá (không tab Tuyến đường).
10. **Map `customers.tuyen_phuong` → route:** out of scope v1.
