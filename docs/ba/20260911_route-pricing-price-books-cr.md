# Change Request: Route Pricing — scope theo Bảng giá (không theo NCC)

**Ngày:** 2026-09-11  
**Status:** Draft (Phase 1.5 / 2)  
**Feature gốc:** `docs/ba/20260711_route-pricing-analysis.md`  
**UI Spec:** `docs/ui/20260911_route-pricing-price-books-cr-ui-spec.md`  
**Module:** `route_pricing`  
**Impact:** LARGE

---

## 1. Nguồn yêu cầu

Chức năng Giá theo tuyến **không còn phụ thuộc nhà cung cấp**. Scope dữ liệu (nhóm tuyến, tuyến, giá, ma trận, lookup) gắn **Bảng giá**. User **tạo** bảng giá và **đặt tên tự do**.

## 2. Phạm vi

**Trong scope**
- Entity master `price_books` (tên do user đặt)
- `delivery_routes` / `route_groups` đổi `supplier_id` → `price_book_id`
- API/FE selector + CRUD tên bảng giá
- Unique tuyến/nhóm theo bảng giá (cùng rule XOR đích + note)
- Migrate data hiện có: 1 NCC đang có tuyến/nhóm → 1 bảng giá (tên mặc định từ mã + tên NCC)
- Seed F-sheet: tìm/tạo bảng giá theo tên sheet, không bắt buộc supplier

**Ngoài scope**
- Catalog nhà cung cấp (`suppliers`, `customer_suppliers`)
- Kỳ điều chỉnh global
- Công thức giá, mode `by_weight` / `by_trips`, ma trận, cascade kỳ
- **Lookup toàn bộ** (`GET /route-pricing/lookup`, matching, Delivery Import) — CR riêng sau. Endpoint giữ nguyên contract `supplier_id` nếu compile được; không đổi rule matching / không viết test lookup mới. Nếu SQL lookup gãy vì drop `supplier_id`, chỉ stub/throw rõ (`LOOKUP_DEFERRED`) chứ không migrate lookup sang `price_book_id` trong CR này.

## 3. Data model (delta)

```
price_books (
  id SERIAL PK,
  name VARCHAR(255) NOT NULL,          -- trim, user-defined
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_by, updated_by, created_at, updated_at
)
UNIQUE active: lower(trim(name)) WHERE status = 'active'

delivery_routes.price_book_id  NOT NULL FK → price_books(id)
route_groups.price_book_id     NOT NULL FK → price_books(id)
DROP supplier_id trên hai bảng này
```

Unique tuyến/nhóm: thay `supplier_id` bằng `price_book_id` (giữ COALESCE ward/location/note).

## 4. Business rules (delta)

- **BR-PB-001:** Bảng giá là đơn vị scope. Mọi list/create nhóm, tuyến, giá, matrix, lookup bắt buộc `price_book_id` của bản ghi `active`.
- **BR-PB-002:** Tên bảng giá do user nhập tự do (không sinh từ NCC). Unique không phân biệt hoa thường sau trim. Rỗng / chỉ whitespace → 400.
- **BR-PB-003:** Tạo / đổi tên / xóa (soft `status=deactive`) cần `route_pricing.manage`. Xóa khi còn nhóm hoặc giá active → confirm cascade soft (nhóm + tuyến) hoặc 409 nếu chọn chặn — **chốt implement: xóa = confirm + soft-delete book; nhóm/tuyến active trong book cũng soft-delete; versions giữ lịch sử.**
- **BR-PB-004:** Kỳ điều chỉnh vẫn global. Copy confirm “mọi nhà cung cấp” → “mọi bảng giá”.
- **BR-PB-005:** Lookup **không đổi** trong CR này (xem ngoài scope).
- **BR-PB-006:** Data cũ: mỗi `supplier_id` xuất hiện trên `route_groups`/`delivery_routes` → một `price_books` tên `{supplier_code} — {name}` (cắt 255). Nếu NCC không còn: `Bảng giá #{supplier_id}`.

## 5. API (delta)

| Method | Path | Auth | Ghi chú |
|--------|------|------|---------|
| GET/POST | `/route-pricing/price-books` | view / manage | List active; create `{ name }` |
| PUT | `/route-pricing/price-books/:id` | manage | Đổi tên |
| DELETE | `/route-pricing/price-books/:id` | manage | Soft-delete + cascade soft nhóm/tuyến |
| GET/POST/PUT/DELETE routes, groups, prices, matrix | như cũ | | Query/body `price_book_id` **thay** `supplier_id` (breaking) |
| GET lookup | — | **Không đổi** trong CR này |

## 6. Không làm

- Không map 1–1 bắt buộc bảng giá ↔ NCC sau migrate
- Không xóa menu/catalog nhà cung cấp
- Không đổi permission codes
