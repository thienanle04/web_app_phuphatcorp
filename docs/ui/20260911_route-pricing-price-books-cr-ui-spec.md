# UI Spec CR: Bảng giá thay nhà cung cấp (route pricing)

**Ngày:** 2026-09-11  
**BA Doc:** `docs/ba/20260911_route-pricing-price-books-cr.md`  
**Role:** `route_pricing.view` / `route_pricing.manage`  
**Phạm vi UI:** Shell trang `/route-pricing` — selector + CRUD Bảng giá; copy/empty state; URL query; đổi nhãn tab ma trận  
**Giữ nguyên:** Layout tab Kỳ / Nhóm tuyến / Quản lý giá / ma trận; modal nhóm & giá; form kỳ; **không đụng UI/API lookup** (CR sau)

**Web Design Guidelines (spec-time):** label trên mọi control; query URL đồng bộ state; confirm destructive; `aria-label` nút icon; empty/error/loading; placeholder kết thúc `…`; heading `h1` giữ; tên bảng giá dài dùng `truncate` + `min-w-0`; không `div onClick` cho action.

---

## 1. User Journey

### Happy Path — chọn bảng giá và làm việc
```
Sidebar → Giá theo tuyến
  → Header: Select “Bảng giá *” (loading… → danh sách tên)
  → URL ?priceBookId=&tab=
  → Chọn một bảng → tab Nhóm tuyến / Quản lý giá / Ma trận giá load theo book
```

### Happy Path — tạo bảng giá
```
Manage: click “Tạo bảng giá”
  → Modal: Tên * (placeholder “VD: CLF nội thành…”)
  → Lưu → toast “Đã tạo bảng giá” → select chuyển sang book mới → tabs sẵn sàng (nhóm trống)
```

### Happy Path — đổi tên
```
Đã chọn book → “Đổi tên”
  → Modal prefill tên hiện tại → Lưu
  → Toast → select refresh, URL giữ cùng id
```

### Happy Path — xóa bảng giá
```
Đã chọn book → “Xóa”
  → Confirm: nêu rõ nhóm tuyến trong bảng sẽ ngừng dùng
  → Soft-delete → toast → select book còn lại (id nhỏ nhất theo tên) hoặc empty CTA tạo mới
```

### Alternative Paths
```
- Tab Kỳ điều chỉnh: ẩn selector + nút CRUD book (giống ẩn NCC hiện tại) — kỳ vẫn global
- View-only: thấy select, không Tạo / Đổi tên / Xóa
- Hủy modal → không lưu
- Chưa có book nào: empty CTA “Tạo bảng giá” (manage) / “Chưa có bảng giá” (view)
```

### Error Paths
```
- Tên trùng / rỗng → inline dưới field (400)
- Load list fail → error + Thử lại
- Xóa/tạo fail → toast, modal mở, data giữ
- priceBookId trên URL không còn active → coi như chưa chọn, empty + toast
```

---

## 2. Screen Inventory

### Screen A: Shell Giá theo tuyến (cập nhật)

**Route:** `/route-pricing?tab=&priceBookId=` (bỏ `supplierId`)  
**Role:** view / manage

#### Layout
```
┌──────────────────────────────────────────────────────────────────────────┐
│ h1 Giá theo tuyến                                                         │
│ Subtitle: Quản lý kỳ điều chỉnh, nhóm tuyến và giá theo từng bảng giá     │
│                                                                           │
│ [Select Bảng giá *          ] [+] [✎] [🗑]   ← icon-only, aria-label     │
│   options = tên book; truncate tên dài                                    │
├──────────────────────────────────────────────────────────────────────────┤
│ Kỳ điều chỉnh | Nhóm tuyến | Quản lý giá | Ma trận giá                    │
│                                          ↑ đổi nhãn từ “Bảng giá”         │
└──────────────────────────────────────────────────────────────────────────┘
```

- Select: `label` “Bảng giá *”, `name="priceBookId"`, `autocomplete="off"`
- Tạo / Đổi tên / Xóa: icon-only (`Plus` / `Pencil` / `Trash2`), `aria-label` + `title` từ i18n
- Đổi tên / Xóa disabled khi chưa chọn book; Xóa `variant=danger`

#### States
| State | Trigger | UI |
|-------|---------|-----|
| Loading books | Fetch list | Select disabled, text “Đang tải…” |
| Empty books | `[]` | Không render tabs groups/manage/matrix; dashed empty + CTA Tạo (manage) |
| Error books | API fail | Text lỗi + Thử lại |
| No selection | URL trống sau load | Placeholder “Chọn bảng giá…” |
| Populated | Có books | Select + tabs theo `priceBookId` |
| Periods tab | `tab=periods` | Selector `invisible` giữ chỗ (như hiện tại) |

#### Actions
| Action | Trigger | Kết quả |
|--------|---------|---------|
| Chọn book | Change select | Set `priceBookId`, refetch groups/prices/matrix |
| Tạo | Click | PriceBookFormModal create |
| Đổi tên | Click | PriceBookFormModal edit |
| Xóa | Click | Confirm dialog |

**Default chọn:** sau load, nếu URL không có id hợp lệ → chọn book đầu tiên sort tên `vi` numeric (không còn sort `supplier_code`).

---

### Screen B: Modal Tạo / Đổi tên bảng giá

**Loại:** Modal `sm`  
**Mở khi:** Tạo hoặc Đổi tên

#### Layout
```
┌─────────────────────────────────┐
│ Tạo bảng giá / Đổi tên      [X] │
├─────────────────────────────────┤
│ Tên *                           │
│ [Input]                         │
├─────────────────────────────────┤
│ Hủy              Lưu            │
└─────────────────────────────────┘
```

- `maxLength=255`, `spellCheck={false}`, `autocomplete="off"`
- Unsaved: Hủy đóng ngay (1 field — không cần `beforeunload`)

#### States
| State | Trigger | UI |
|-------|---------|-----|
| Default | Tạo | Input rỗng, Lưu enabled |
| Edit | Đổi tên | Prefill |
| Submitting | Lưu | Lưu disabled + spinner “Đang lưu…” |
| Field error | 400 unique/empty | Inline dưới input, focus field |
| API error | 500 | Toast, form giữ |
| Success | 2xx | Toast, đóng modal |

---

### Screen C: Confirm xóa bảng giá

**Loại:** Modal confirm  
**Copy:** “Xóa bảng giá “{name}”? Nhóm tuyến trong bảng này sẽ ngừng sử dụng. Không hoàn tác từ giao diện.”  
**Nút:** Hủy / Xóa bảng giá (danger, spinner “Đang xóa…”)

---

### Screen D: Tab Kỳ — copy confirm (cập nhật)

Thay “mọi nhà cung cấp” → “mọi bảng giá đang có giá hiệu lực”.

---

### Screens giữ nguyên (chỉ đổi prop `supplierId` → `priceBookId`)

Nhóm tuyến, Quản lý giá, Ma trận giá, modal nhóm/giá — layout/states như spec 2026-07-31.

---

## 3. Component Checklist

| Component | File | Loại | Dùng ở |
|-----------|------|------|--------|
| RoutePricingPage shell | `frontend/src/pages/route-pricing/RoutePricingPage.tsx` | Cập nhật | Screen A |
| PriceBookFormModal | cùng file hoặc `components/route-pricing/` | Mới | Screen B |
| DeletePriceBookDialog | cùng / tách | Mới | Screen C |
| PriceMatrixTab | `PriceMatrixTab.tsx` | Cập nhật prop | Ma trận |
| useRoutePricing / API | hooks + `routePricingApi.ts` | Cập nhật | tất cả |
| Periods confirm copy | RoutePricingPage | Cập nhật | Screen D |

```
- [ ] Loading / empty / error cho list books và từng tab
- [ ] Toast sau create / rename / delete
- [ ] Confirm trước xóa
- [ ] Submit disabled + spinner khi đang gửi
- [ ] URL priceBookId + tab
```

---

## 4. Validation UX

| Trường hợp | Ở đâu | Khi nào | Message |
|------------|-------|---------|---------|
| Tên trống | Inline | Blur/submit | “Nhập tên bảng giá” |
| Tên trùng | Inline | Sau submit | “Tên bảng giá đã tồn tại” |
| Book không tồn tại | Toast | Load/mutate | “Không tìm thấy bảng giá” |
| 500 | Toast | Sau submit | “Lỗi hệ thống, vui lòng thử lại” |
| 401 | Redirect login | | — |

---

## 5. i18n Keys

Trang hiện hardcode tiếng Việt; thêm key (vi + en) khi đụng i18n:

```
routePricing.page.subtitle
routePricing.priceBook.label
routePricing.priceBook.placeholder
routePricing.priceBook.empty
routePricing.priceBook.emptyCta
routePricing.priceBook.create
routePricing.priceBook.rename
routePricing.priceBook.delete
routePricing.priceBook.name
routePricing.priceBook.nameRequired
routePricing.priceBook.duplicate
routePricing.priceBook.confirmDelete
routePricing.tab.matrix
routePricing.message.success.createBook
routePricing.message.success.renameBook
routePricing.message.success.deleteBook
routePricing.periods.confirmCreate
```

Nhãn tab ma trận **vi:** “Ma trận giá” (tránh trùng “Bảng giá” trên select).
