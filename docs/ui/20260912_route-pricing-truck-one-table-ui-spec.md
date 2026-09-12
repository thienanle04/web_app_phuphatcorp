# UI Spec: Ma trận by_truck — một bảng / price book

**Ngày:** 2026-09-12  
**BA Doc (gốc):** `docs/ba/20260912_route-pricing-by-truck-analysis.md`  
**UI Spec gốc (delta Screen C):** `docs/ui/20260912_route-pricing-by-truck-ui-spec.md`  
**Role:** `route_pricing.view`  
**Phạm vi:** Tab **Bảng giá** section **Theo loại xe**  
**Giữ nguyên:** Modal thêm/sửa giá gốc, card lịch sử version, `weight_tables`, bảng chuyến, filter Từ kỳ  

---

## 1. User Journey

### Happy Path
```
Tab Bảng giá → chọn price book đã có ≥1 nhóm by_truck
  → Section “Theo loại xe”: đúng một bảng
  → Hàng = từng nhóm tuyến by_truck (sort tỉnh rồi tên)
  → Cột bậc = hợp nhãn (label + đơn vị) của mọi nhóm trong book; Pallet cuối
  → Ô không có bậc tương ứng để trống
  → Filter Từ kỳ áp dụng như các section khác
```

### Alternative Paths
```
- Không nhóm by_truck → không section “Theo loại xe”
- Chỉ một schema nhãn → vẫn một bảng (như hiện tại, không subtitle fingerprint)
- Cuộn ngang nếu nhiều cột; sticky STT + Tuyến
```

### Error Paths
```
- Load ma trận fail → text + Thử lại (pattern tab hiện có)
```

---

## 2. Screen Inventory

### Screen C (delta): Tab Bảng giá — Theo loại xe

**Route:** `/route-pricing` tab Bảng giá  
**Role:** `route_pricing.view`  
**Điều kiện:** `truck_tables.length > 0` (kỳ vọng 0 hoặc 1 phần tử)

#### Layout
```
[Select Từ kỳ — không đổi]

Theo trọng lượng
  … nhiều bảng theo schema (không đổi) …

Theo loại xe
  [Đúng 1 bảng — mọi tuyến by_truck của price book]

Theo chuyến / xe / ngày
  … không đổi …
```

Layout bảng: tái dụng `PriceMatrixWeightTableView` (3 tầng header).

- **Không** render dòng `schema_label` dưới heading (tránh chuỗi nhãn dài khi union).
- Heading section vẫn `h2` “Theo loại xe”.
- Cột: unique `t:{label}:{unit}` theo **thứ tự xuất hiện**: duyệt nhóm đã sort (tỉnh, tên), trong mỗi nhóm theo `sort_order` bậc; cột mới append; Pallet luôn cuối.
- Cùng `(label, unit)` từ hai nhóm → một cột.
- Khác chính tả / khác đơn vị → cột khác.
- Ô null: cell trống (không “—”, không 0 giả).
- Pallet = 0: ẩn cột Pallet như bảng weight hiện tại (nếu đang ẩn).
- Nhãn cột: `break-words`, `max-w` 8–10rem.

#### States

| State | UI |
|-------|-----|
| Loading / error / empty book | Giữ tab hiện có |
| Có truck | Một bảng trong section giữa weight và trips |
| Không truck | Không heading section |

#### Actions

Không action mới. Filter Từ kỳ dùng chung `visiblePeriods`.

---

## 3. Component Checklist

| Component | File | Loại | Ghi chú |
|-----------|------|------|---------|
| `PriceMatrixTab` | `frontend/src/pages/route-pricing/PriceMatrixTab.tsx` | Cập nhật | Ẩn `schema_label` khi `kind === 'truck'` (hoặc khi section truck) |
| `PriceMatrixWeightTableView` | cùng file | Cập nhật | Prop ẩn caption nếu cần, không tách component mới |
| Types / hooks | không đổi shape | — | Vẫn `truck_tables[]` |

States bắt buộc: loading / error / empty tab — giữ. Không empty-state giả cho truck.

---

## 4. Validation UX

Không form mới. Null cell không phải lỗi.

---

## 5. Copy

| Key | Text |
|-----|------|
| matrix.section.truck | Theo loại xe |

Không thêm caption phụ dưới bảng.

---

## 6. Web Design Guidelines

- Cột số `tabular-nums`; user content `break-words`.
- Sticky cột đầu; `overflow-auto` khi union nhiều cột.
- Không animation mới; heading hierarchy giữ `h2` section.
- Placeholder/ellipsis không liên quan (không form).
