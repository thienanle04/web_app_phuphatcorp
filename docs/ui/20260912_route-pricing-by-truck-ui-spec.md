# UI Spec: Chế độ tính giá theo loại xe (Truck)

**Ngày:** 2026-09-12  
**BA Doc:** `docs/ba/20260912_route-pricing-by-truck-analysis.md`  
**Role liên quan:** `route_pricing.manage` (nhập), `route_pricing.view` (xem)  
**Phạm vi UI:** Modal **Thêm/Sửa bảng giá gốc**, card **Lịch sử phiên bản**, tab **Bảng giá** (ma trận)  
**Giữ nguyên:** shell `RoutePricingPage`, tab Nhóm tuyến, Kỳ điều chỉnh, form weight/trips hiện có  

---

## 1. User Journey

### Happy Path — tạo giá theo loại xe
```
Tab Quản lý giá → nhóm chưa có giá gốc → “Thêm bảng giá gốc”
  → Modal: Pallet, radio chế độ (mặc định Theo trọng lượng)
  → User chọn “Theo loại xe”
  → Confirm nếu đang có bậc mode khác → form 1 dòng trống
  → User gõ nhãn (vd. Truck 0,5mt), chọn Chuyến hoặc Tấn, nhập giá
  → “+ Thêm bậc” → dòng mới; lặp (có thể trộn đơn vị)
  → Lưu → toast thành công → modal đóng → card version badge “Theo loại xe”
  → Tab Bảng giá: section “Theo loại xe” giữa trọng lượng và chuyến
```

### Happy Path — sửa giá gốc Truck
```
Card version gốc → Sửa
  → Prefill Pallet, radio Theo loại xe, từng dòng nhãn + đơn vị + giá
  → Sửa / thêm / xóa (≥1 dòng) → Lưu → cascade kỳ sau (user không nhập lại nhãn kỳ sau)
```

### Alternative Paths
```
- Đổi radio (chưa lưu) → confirm “Đổi chế độ sẽ xóa các bậc đang nhập. Tiếp tục?” → reset form mode mới
- Hủy modal → không lưu
- View-only → không nút Thêm/Sửa bảng giá gốc
- Không nhóm by_truck → tab Bảng giá không có section loại xe (không empty-state giả)
```

### Error Paths
```
- API 400 (nhãn trùng / rỗng / giá ≤ 0) → toast, modal mở, data giữ
- API 500 → toast lỗi hệ thống, form giữ
- Load ma trận fail → error + Thử lại (giữ pattern tab hiện tại)
```

---

## 2. Screen Inventory

### Screen A: Modal Thêm / Sửa bảng giá gốc (cập nhật)

**Loại:** Modal `size="lg"` (component `Modal` hiện có)  
**Route:** `/route-pricing` (không đổi)  
**Role:** `route_pricing.manage`  
**Mở khi:** thêm giá gốc nhóm chưa có config, hoặc sửa version gốc  

#### Layout — chung (delta)
```
┌─────────────────────────────────────────────────────────────┐
│ Thêm bảng giá gốc / Sửa bảng giá gốc                    [X] │
├─────────────────────────────────────────────────────────────┤
│ Kỳ gốc * (chỉ tạo mới)                                      │
│ Giá Pallet (chuyến) *                                       │
│                                                             │
│ Chế độ áp giá *                                             │
│  ( ) Theo trọng lượng                                       │
│  ( ) Theo số chuyến/xe/ngày                                 │
│  ( ) Theo loại xe                                           │
│  [hint 1 dòng — chỉ khi radio loại xe]                      │
│                                                             │
│ Bậc điều kiện *                                             │
│  ┌─ (tier rows — phụ thuộc chế độ) ─────────────────────┐   │
│  └─────────────────────────────────────────────────────┘   │
│  [+ Thêm bậc]                                               │
├─────────────────────────────────────────────────────────────┤
│                              [Hủy]  [Lưu]                   │
└─────────────────────────────────────────────────────────────┘
```

Hint (khi `by_truck`):  
`Nhãn bậc copy từ Excel (loại / tải xe, ví dụ Truck 0,5mt hoặc 8 < Truck ≤16). Không dùng tấn hàng trên phiếu.`

#### Layout — mode `by_truck` (mỗi bậc)
```
┌─────────────────────────────────────────────────────────────┐
│ Nhãn loại xe *     Đơn vị *        Đơn giá *         [🗑]   │
│ [text input      ] [Chuyến|Tấn]    [number]                 │
└─────────────────────────────────────────────────────────────┘
```

- **Không** hiện Từ/Đến tấn, min tính, Từ/Đến chuyến.
- Placeholder nhãn: `vd. Truck 0,5mt…`
- `name` gợi ý: `truck-tier-label`, `truck-tier-unit`, `truck-tier-price` (+ index).
- `spellCheck={false}` trên nhãn (ký hiệu ≤, số).
- Xóa: ẩn/disable 🗑 khi còn đúng 1 bậc (giữ ≥1).
- Thêm bậc: append 1 dòng `{ label: '', pricing_unit: 'chuyen', price: 0 }`.
- Đơn vị mặc định dòng mới: **Chuyến**.
- Nhãn dài: `min-w-0` + input full width trên wrap (`flex-wrap` như form weight).

#### Layout — mode weight / trips
Không đổi so với UI Spec 2026-07-13.

#### States

| State | Trigger | UI |
|-------|---------|-----|
| Default create weight | Mở thêm mới | Radio trọng lượng + template 5 bậc |
| Switch to truck | Confirm OK | Radio loại xe + **đúng 1** dòng trống; hint hiện |
| Edit truck | Mở từ version `by_truck` | Prefill đủ dòng; radio loại xe |
| Submitting | Click Lưu | Lưu disabled + spinner; form lock |
| Submit error | API fail | Toast; form mở; data giữ; focus không bắt buộc nhảy nếu lỗi là toast BE |
| Submit success | API OK | Toast; đóng modal; list/card refresh |
| Unsaved mode switch | Đổi radio | `window.confirm` (cùng copy hiện tại) |

#### Actions

| Action | Trigger | Kết quả |
|--------|---------|---------|
| Chọn Theo loại xe | Radio | Confirm nếu mode khác → reset 1 dòng trống |
| Thêm bậc | Nút | Thêm dòng cuối |
| Xóa bậc | 🗑 | Xóa dòng nếu >1 |
| Lưu | Nút Lưu | POST/PUT `pricing_mode: by_truck`, `tiers[].label` trim phía BE |
| Hủy / X | | Đóng, không lưu |

Client **không** chặn paste. Validate trùng nhãn có thể toast FE trước submit (cùng rule trim) nhưng BE là nguồn sự thật.

---

### Screen B: PriceVersionCard (cập nhật)

**Điều kiện:** version `pricing_mode === 'by_truck'`

Badge: `Theo loại xe` (cùng chỗ badge weight/trips; variant `info` hoặc `default` như card hiện tại).

Bảng bậc:

| Loại xe | Đơn vị | Đơn giá |
|---------|--------|---------|
| đúng `label` (break-words) | vnđ/chuyến \| vnđ/tấn | `Intl` vi-VN, `tabular-nums` |

Pallet = 0 → ẩn như hiện tại; > 0 hiện dòng Pallet.

Không hiện khoảng `(from, to]` hay `0 tấn`.

---

### Screen C: Tab Bảng giá — section Theo loại xe (mới)

**Route:** `/route-pricing` tab Bảng giá  
**Role:** `route_pricing.view`  
**Điều kiện hiển thị:** `truck_tables.length > 0`

#### Layout
```
[Select Từ kỳ — không đổi]

Theo trọng lượng
  … weight_tables …

Theo loại xe
  [đúng 1 bảng — mọi tuyến by_truck của price book]

Theo chuyến / xe / ngày
  … trips …
```

Mỗi bảng truck **tái sử dụng** layout 3 tầng header của bảng trọng lượng (`PriceMatrixWeightTableView` hoặc clone props):

- Tầng kỳ | tầng nhãn bậc (`label` user) + Pallet | tầng `unit_label`
- Sticky STT + Tuyến; giá `tabular-nums`
- Nhãn cột dài: `break-words`, `max-w` hợp lý (vd. 8–10rem), không truncate mất `≤` / `<`

Không render heading “Theo loại xe” khi không có bảng.

#### States

| State | UI |
|-------|-----|
| Loading ma trận | Skeleton/spinner tab hiện có |
| Error | Text + Thử lại |
| Có weight không truck | Chỉ section trọng lượng (+ trips nếu có) |
| Có truck | Section giữa weight và trips |
| Empty book | Empty tab hiện có — không thêm CTA riêng Truck |

Filter “Từ kỳ” áp dụng **cùng** `visiblePeriods` cho bảng truck.

---

## 3. Component Checklist

| Component | File path | Loại | Dùng ở |
|-----------|-----------|------|--------|
| `PriceFormModal` | `frontend/src/pages/route-pricing/RoutePricingPage.tsx` | Cập nhật | Screen A |
| `PriceVersionCard` | `RoutePricingPage.tsx` | Cập nhật | Screen B |
| `PriceMatrixTab` | `frontend/src/pages/route-pricing/PriceMatrixTab.tsx` | Cập nhật | Screen C |
| `PriceMatrixWeightTableView` | cùng file | Cập nhật hoặc tái sử dụng với `kind: truck` | Screen C |
| Types / hooks | `frontend/src/api/routePricingApi.ts`, `hooks/useRoutePricing.ts` | Cập nhật | `PricingMode`, `label`, `truck_tables` |

### States bắt buộc

```
- [ ] Loading — skeleton/spinner ma trận (giữ)
- [ ] Empty section truck — không render block (không illustration giả)
- [ ] Error ma trận — message + Thử lại
- [ ] Toast sau Lưu / lỗi
- [ ] Confirm đổi chế độ (destructive reset)
- [ ] Submit disabled khi pending
- [ ] 🗑 disabled khi 1 bậc truck
- [ ] Nhãn dài trên form + header ma trận + card (break-words)
```

---

## 4. Validation UX

| Trường hợp | Hiển thị ở đâu | Khi nào | Ví dụ message |
|------------|----------------|---------|----------------|
| Nhãn trống / chỉ space | Toast sau submit (BE); optional inline | Submit | Nhãn loại xe không được trống |
| Hai nhãn trùng sau trim | Toast BE | Submit | Các bậc trùng nhãn |
| Giá ≤ 0 | Toast BE | Submit | Giá phải > 0 |
| Thiếu bậc | Toast BE | Submit | Cần ít nhất 1 bậc |
| Đổi chế độ | `window.confirm` | Đổi radio | Đổi chế độ sẽ xóa các bậc đang nhập. Tiếp tục? |
| Server 500 | Toast | Sau submit / load | Lỗi hệ thống, vui lòng thử lại |
| 401 | Redirect login | Như app | — |

Không hiện lỗi “chồng khoảng” cho mode truck.  
Không `alert` native trừ confirm đổi mode (pattern hiện tại).

Focus: radio và input có `label` clickable (`htmlFor` hoặc wrap). Nút 🗑 icon-only → `aria-label="Xóa bậc"`.

---

## 5. Copy / i18n

Project hardcode VI — không thêm i18n framework. Chuỗi:

| Key logic | Text |
|-----------|------|
| mode.truck | Theo loại xe |
| mode.truck.hint | Nhãn bậc copy từ Excel (loại / tải xe, ví dụ Truck 0,5mt hoặc 8 < Truck ≤16). Không dùng tấn hàng trên phiếu. |
| tier.truck.label | Nhãn loại xe |
| tier.truck.placeholder | vd. Truck 0,5mt… |
| badge.truck | Theo loại xe |
| matrix.section.truck | Theo loại xe |
| matrix.kind.pallet | Pallet |
| unit.chuyen | vnđ/chuyến |
| unit.tan | vnđ/tấn |
| confirm.switchMode | Đổi chế độ sẽ xóa các bậc đang nhập. Tiếp tục? |
| addTier | + Thêm bậc |

Dấu ba chấm UI: `…` (không `...`). Số tiền: `Intl.NumberFormat('vi-VN')`.

---

## 6. Web Design Guidelines (spec check)

Áp dụng khi implement (Vercel Web Interface Guidelines):

- Form: label gắn control; không chặn paste; submit enabled đến lúc request; spinner khi saving (`Saving…` nếu có chữ loading).
- Radio: label + input cùng hit target (pattern hiện có).
- Icon 🗑: `aria-label`.
- Confirm trước khi xóa dữ liệu bậc (đổi mode).
- User content (nhãn Excel): `break-words` / `min-w-0`; không cắt mất toán tử.
- Cột số: `tabular-nums`.
- Modal: `overscroll-behavior: contain` (giữ `Modal` hiện có).
- Focus visible trên radio/input/button; không `outline-none` trần.
- Heading section ma trận `h2` text-sm — giữ hierarchy trang (page title vẫn trên cùng).
- Không Title Case tiếng Anh trên nút VI (giữ “Thêm bậc”, “Lưu”, “Hủy”).
- `prefers-reduced-motion`: không thêm animation mới ngoài spinner hiện có.
- Placeholder kết thúc `…` và là ví dụ (`vd. Truck 0,5mt…`).

---

## 7. Design notes

- Không card hero, không preset 5 class, không toggle “class rời | khoảng”.
- Tái dụng `Input` / `Select` / `Button` / `Badge` / `Modal`.
- Mobile: hàng bậc `flex-wrap`, 🗑 cùng hàng hoặc xuống dòng `items-end`.
- Không deep-link mode trong URL (modal ephemeral, giống hiện tại).
