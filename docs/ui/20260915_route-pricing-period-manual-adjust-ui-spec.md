# UI Spec: Sửa giá theo kỳ (manual adjust)

**Ngày:** 2026-09-15, cập nhật 2026-09-17 cho bộ giá  
**BA Doc:** `docs/ba/20260915_route-pricing-period-manual-adjust-analysis.md` (kỳ lẻ). Luật giá hiện tại: `docs/ba/20260917_route-pricing-price-sets-analysis.md`  
**Role liên quan:** `route_pricing.manage` (sửa), `route_pricing.view` (xem dấu)  
**Phạm vi UI:** Tab **Quản lý giá** (card kỳ + bút chì), modal điều chỉnh kỳ, tab **Bảng giá** (highlight)  
**Giữ nguyên:** shell `RoutePricingPage`. Form giá gốc nằm ở `PriceFormModal.tsx` (chọn bộ, giá `> 0`, confirm recascade). Không sửa từ ma trận.

Luật thay spec gốc 2026-09-15: không lưu giá `0` mới. Ô trống = không có record. Không điều chỉnh Pallet về `0`. Card vẫn hiện badge “Pallet được điều chỉnh về 0” nếu dữ liệu cũ có `pallet_trip_price === 0` và cờ chỉnh tay.

**Web Interface Guidelines (self-check trước khi lưu):**
- Icon-only Pencil: bắt buộc `aria-label`
- Modal: `overscroll-behavior: contain` (Modal hiện có); focus trap giữ pattern hệ thống
- Confirm destructive-ish cascade: modal confirm, không immediate
- Số cột: `tabular-nums`
- Loading submit: disable nút + spinner; toast `aria-live` qua toast hiện có
- Không `window.confirm` cho luồng này (Q14)
- Copy ellipsis `…` trong loading strings

---

## 1. User Journey

### Happy Path — sửa giá kỳ giữa
```
Giá theo tuyến → chọn bảng giá → tab Quản lý giá → chọn nhóm có lịch sử version
  → Card kỳ (không chỉ gốc) hiện [Pencil]
  → Click Pencil → Modal “Điều chỉnh giá — [ngày kỳ]”
  → Prefill Pallet + mọi bậc (chỉ input Đơn giá; nhãn/đơn vị read-only)
  → User đổi 1+ ô → nút Lưu enable
  → Lưu → Modal confirm mở
       • Bảng ô đổi: nhãn | cũ → mới
       • Kỳ sau: danh sách ngày start; dòng có mất dấu ghi chú
  → Xác nhận → API → toast thành công → đóng cả 2 modal → refresh cards + invalidate matrix
  → Card: * trên ô đã sửa; ô không có giá không hiện `0`
  → Ma trận: ô đã sửa highlight nền; ô null hiện “-”
```

### Alternative Paths
```
- Hủy edit modal / X → không lưu; discard draft
- Hủy confirm → về edit modal, giữ số đang nhập
- Không dirty → Lưu disabled
- View-only → không Pencil
- Sửa bảng giá gốc: chọn bộ (khóa nếu đã có giá), giá > 0, confirm mất dấu kỳ sau
- Kỳ chưa có pallet / chưa có bậc: để trống (không thêm) hoặc nhập > 0 để áp dụng từ kỳ này
```

### Error Paths
```
- API 400/500 → toast lỗi; confirm đóng hoặc giữ edit mở với data; không clear form
- Load versions fail → giữ error + Thử lại hiện tại
```

---

## 2. Screen Inventory

### Screen A: Card phiên bản giá (cập nhật) — tab Quản lý giá

**Route:** `/route-pricing?tab=manage&…`  
**Role:** view thấy card; manage thấy Pencil  
**Điều kiện:** `versions.length > 0`

#### Layout (delta trên header card)
```
┌──────────────────────────────────────────────────────────────┐
│ [Badges…]                                      [Pencil] (*)  │
│ effective_from → effective_to                                │
│                                                              │
│ Pallet: 1.200.000 *     |  badge Pallet→0 chỉ nếu dữ liệu cũ │
│                                                              │
│ Table bậc: nhãn | đơn vị | đơn giá [ * nếu manual ]          │
│            …      …        -     *                           │
└──────────────────────────────────────────────────────────────┘
(*) Pencil chỉ khi canManage; aria-label="Điều chỉnh giá kỳ này"
```

#### Hiển thị giá
| Điều kiện | UI |
|-----------|-----|
| `price == null` hoặc không có record | Không hiện số; ma trận dùng `-` |
| Pallet `=== 0` && `pallet_manual_adjusted` (dữ liệu cũ) | Badge “Pallet được điều chỉnh về 0” + `-`. Không tạo trạng thái này từ form mới. |
| `is_manual_adjusted` hoặc pallet manual với giá > 0 | `*` cạnh số; `title`/`aria-label`="Đã điều chỉnh" |
| Không manual | Chỉ số (hoặc `-`) |

#### Actions
| Action | Trigger | Kết quả |
|--------|---------|---------|
| Điều chỉnh giá | Pencil | Mở Screen B với `version` |

---

### Screen B: Modal Điều chỉnh giá kỳ

**Loại:** Modal `size="lg"`  
**Mở khi:** Pencil trên card  
**Role:** manage  

#### Layout
```
┌─────────────────────────────────────────────────────────────┐
│ Điều chỉnh giá — dd/mm/yyyy                             [X] │
├─────────────────────────────────────────────────────────────┤
│ Hint: Chỉ sửa đơn giá. Các kỳ sau sẽ được tính lại theo %   │
│       của từng kỳ (làm tròn nghìn).                         │
│                                                             │
│ Giá Pallet (chuyến)                                         │
│ [ number input ]                                            │
│                                                             │
│ Bậc (read-only nhãn + đơn vị | input giá)                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Nhãn / khoảng     Đơn vị      Đơn giá (vnđ)         │    │
│  │ Truck 0,5mt       vnđ/chuyến  [________]            │    │
│  │ …                                                   │    │
│  └─────────────────────────────────────────────────────┘    │
│ Bậc đã có: không xóa trắng, không đổi mode.                 │
│ Bậc của bộ chưa có giá: ô trống = không dùng; nhập > 0    │
│ = thêm từ kỳ này, kỳ sau scale theo %.                     │
├─────────────────────────────────────────────────────────────┤
│                              [Hủy]  [Lưu]                   │
└─────────────────────────────────────────────────────────────┘
```

#### States
| State | UI |
|-------|-----|
| Default | Prefill từ version; Lưu **disabled** |
| Dirty | Lưu enabled |
| Submitting | Không submit từ đây — mở confirm trước; khi API chạy: disable Xác nhận |
| Validation | Bậc đã có: trống hoặc ≤ 0 → inline, chặn confirm. Bậc chưa có: trống hợp lệ; nhập ≤ 0 → inline |

#### Validation UX
| Rule | Message |
|------|---------|
| Bắt buộc số (bậc hoặc pallet đã có) | “Nhập đơn giá” |
| ≤ 0 | “Giá phải lớn hơn 0” |
| NaN | “Giá không hợp lệ” |
| Bậc / pallet chưa có, để trống | Hợp lệ — không thêm |

**Dirty:** so sánh số với giá gốc (Number); Pallet + từng tier.id.

**Lưu:** nếu dirty & valid → mở Screen C (không gọi API).

---

### Screen C: Modal Confirm điều chỉnh giá

**Loại:** Modal `size="md"` hoặc `lg` nếu nhiều dòng  
**Mở khi:** Lưu từ Screen B  

#### Layout
```
┌─────────────────────────────────────────────────────────────┐
│ Xác nhận điều chỉnh giá                                 [X] │
├─────────────────────────────────────────────────────────────┤
│ Các ô thay đổi                                              │
│  • Pallet: 1.200.000 → 1.500.000                            │
│  • Truck 0,5mt: 1.100.000 → 2.000.000                       │
│                                                             │
│ Các kỳ sau sẽ được tính lại theo %                          │
│  • 01/08/2026                                               │
│  • 01/09/2026 — sẽ mất dấu đã điều chỉnh trên ô vừa sửa     │
│  (Nếu không có kỳ sau: “Không có kỳ sau để cascade.”)       │
├─────────────────────────────────────────────────────────────┤
│                    [Hủy]  [Xác nhận]                        │
└─────────────────────────────────────────────────────────────┘
```

**Không** hiện giá mới đã tính của kỳ sau.  
Không dùng `0` làm giá mới. Confirm hiện số đã nhập.

#### States
| State | UI |
|-------|-----|
| Default | List từ diff phía client + periods từ versions cùng config |
| Submitting | Xác nhận disabled + spinner “Đang lưu…” |
| Error | Toast; modal confirm có thể đóng; edit vẫn mở với data |
| Success | Đóng C + B; toast “Đã điều chỉnh giá” |

**FE tự tính list kỳ sau:** versions có `effective_from` / period start > kỳ đang sửa, sort ASC.  
**Mất dấu:** kỳ sau có `is_manual_adjusted` / `pallet_manual_adjusted` trên **cùng ô** nằm trong diff.

---

### Screen D: Modal Sửa bảng giá gốc

Xem `docs/ui/20260917_route-pricing-price-sets-ui-spec.md` Screen 5. Tóm tắt lệch so với spec 2026-09-15:

- Chọn bộ giá; khóa bộ khi đã có version.
- Giá đã nhập phải `> 0`. Ô trống không sinh record.
- Confirm: kỳ sau được tính lại, chỉnh tay trên kỳ sau mất.
- File: `frontend/src/pages/route-pricing/PriceFormModal.tsx`

---

### Screen E: Tab Ma trận giá (delta)

**Route:** `/route-pricing/matrix`  
**Role:** view  

#### Hiển thị ô
| Điều kiện | UI |
|-----------|-----|
| `value == null` | `-` |
| `manual_adjusted === true` | nền highlight (vd. `bg-amber-50` / dark tương đương); giữ `tabular-nums` |

`formatPriceDisplay` vẫn map số `0` thành `-` nếu dòng cũ còn `0`. Form mới không lưu `0`.

Không nút sửa trên header kỳ / ô.

---

## 3. Component Checklist

| Component | File path | Loại | Dùng ở |
|-----------|-----------|------|--------|
| `PriceVersionCard` | `RoutePricingPage.tsx` (hoặc tách file nếu quá dài) | Cập nhật | Screen A |
| `PeriodPriceAdjustModal` | `frontend/src/pages/route-pricing/PeriodPriceAdjustModal.tsx` (khuyến nghị tách) | Mới | B |
| `PeriodPriceAdjustConfirmModal` | cùng folder hoặc trong file modal | Mới | C |
| `PriceFormModal` | `frontend/src/pages/route-pricing/PriceFormModal.tsx` | Cập nhật theo bộ giá | D |
| `PriceMatrixTab` + cell render | `PriceMatrixTab.tsx` | Cập nhật | E |
| `formatPriceCell(value)` helper | utils hoặc local | Mới | A, E — `0 → '-'`, null → '' |
| `useManualAdjustPrice` | `useRoutePricing.ts` | Mới | B/C |
| API `manualAdjustVersion` | `routePricingApi.ts` | Mới | hook |

### States bắt buộc
```
- [ ] Loading versions / matrix (giữ hiện tại)
- [ ] Empty / error (giữ)
- [ ] Confirm trước cascade
- [ ] Disabled Lưu khi !dirty
- [ ] Submitting trên confirm
- [ ] Toast success / error
- [ ] aria-label trên Pencil
```

---

## 4. Validation UX

| Trường hợp | Ở đâu | Khi nào | Message |
|------------|-------|---------|---------|
| Giá trống / không phải số (ô đã có giá) | Inline dưới input | blur / Lưu | “Nhập đơn giá” / “Giá không hợp lệ” |
| Giá ≤ 0 | Inline | blur / Lưu | “Giá phải lớn hơn 0” |
| Business 400 | Toast | sau Xác nhận | message BE |
| 500 | Toast | sau Xác nhận | “Lỗi hệ thống, vui lòng thử lại” |
| 401 | Redirect login | interceptor | — |

---

## 5. i18n Keys cần thêm

```
routePricing.manage.adjustPrice = "Điều chỉnh giá"
routePricing.manage.adjustPricePeriod = "Điều chỉnh giá — {date}"
routePricing.manage.adjustHint = "Chỉ sửa đơn giá. Các kỳ sau sẽ được tính lại theo % của từng kỳ (làm tròn nghìn)."
routePricing.manage.saveAdjust = "Lưu"
routePricing.manage.confirmTitle = "Xác nhận điều chỉnh giá"
routePricing.manage.confirmChanges = "Các ô thay đổi"
routePricing.manage.confirmLaterPeriods = "Các kỳ sau sẽ được tính lại theo %"
routePricing.manage.confirmNoLater = "Không có kỳ sau để cascade."
routePricing.manage.confirmLoseMark = "sẽ mất dấu đã điều chỉnh trên ô vừa sửa"
routePricing.manage.confirmSubmit = "Xác nhận"
routePricing.manage.palletAdjustedToZero = "Pallet được điều chỉnh về 0"  // chỉ card dữ liệu cũ
routePricing.price.pricePositive = "Giá phải lớn hơn 0"
routePricing.manage.manualMarkTitle = "Đã điều chỉnh"
routePricing.manage.priceZeroDisplay = "-"
routePricing.message.success.manualAdjust = "Đã điều chỉnh giá"
routePricing.message.error.manualAdjust = "Không điều chỉnh được giá"
routePricing.validation.priceRequired = "Nhập đơn giá"
routePricing.validation.priceMin0 = "Giá phải ≥ 0"  // key cũ, form mới dùng price.pricePositive
routePricing.validation.priceInvalid = "Giá không hợp lệ"
```

(EN tương ứng trong `en.json`.)

---

## 6. Screens / Components count

- Screens cập nhật: 3 (card, absolute form validate, matrix)  
- Modal mới: 2 (edit + confirm)  
- Components mới khuyến nghị: 2–3  
