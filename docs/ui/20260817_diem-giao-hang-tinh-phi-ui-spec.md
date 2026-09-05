# UI Spec: Điểm giao hàng tính phí (`customers.diem_giao_hang_tinh_phi`)

**Ngày:** 2026-08-17  
**BA Doc:** `docs/ba/20260817_customer-route-groups-analysis.md` (chỉ phần A — cột text; **không** làm link `route_groups` trong CR này)  
**Role liên quan:** `accounting_data.view` (xem) / `accounting_data.manage` (tạo/sửa/import)  
**Phạm vi:** Cập nhật màn Customers hiện có — **không** thêm screen mới.

---

## 0. Quyết định UI

| Mục | Quyết định |
|-----|------------|
| Field | Optional text, giống `dia_chi_giao_hang` — không `*`, không unique |
| DB / contract | `VARCHAR(255)` nullable; rỗng / chỉ khoảng trắng → `null` |
| List | Thứ tự: **Tuyến-phường** → **Điểm GHTP** → **Tên KH**; **ẩn Tuyến-cũ** khỏi table (vẫn giữ field trên form/Excel) |
| Form | Input text (1 dòng), đặt sau **Địa chỉ giao hàng**, trước checkbox bốc xếp |
| Excel | Cột header optional; thiếu cột không fail |
| Search | Client filter cũng khớp `diem_giao_hang_tinh_phi` |
| Out of scope | Multi-select nhóm tuyến, chips, API `route_group_ids` |

---

## 1. User Journey

### Happy Path
```
Sidebar → Danh sách khách nhận hàng
  → Table hiện cột “Điểm giao hàng tính phí” (text hoặc “—”)
  → Search: gõ một phần text GHTP → hàng khớp hiện ra
  → Thêm mới: nhập (hoặc để trống) Điểm giao hàng tính phí → Submit
      → Toast success → list refresh, cột hiện giá trị vừa nhập
  → Sửa: field prefill (rỗng nếu null) → đổi text → Lưu
      → Toast success → cột cập nhật
  → Import Excel: file có/không có cột “Điểm giao hàng tính phí”
      → Có: map text; Không: field = null, vẫn import được
```

### Alternative Paths
```
- User để trống field khi tạo/sửa → lưu null, list hiện “—”
- User chỉ xem (không manage) → thấy cột, không form
- User hủy modal → không lưu, list không đổi
```

### Error Paths
```
- Text > 255 ký tự → inline error dưới field, không submit
- API fail → toast error, form giữ nguyên
- Load list fail → error + Thử lại (không đổi so với hiện tại)
```

---

## 2. Screen Inventory

### Screen 1: CustomersPage (cập nhật)

**Route:** `/accounting-data/customers`  
**Permission:** `accounting_data.view`

#### Layout (chỉ phần table đổi)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Danh sách khách nhận hàng              [Import Excel] [+ Thêm mới]       │
├──────────────────────────────────────────────────────────────────────────┤
│ [Tìm kiếm theo tên, điểm trả hàng, điểm GHTP…]     [Tất cả tuyến ▼]     │
├──────────────────────────────────────────────────────────────────────────┤
│ STT │ Điểm trả hàng │ Tuyến-phường │ Điểm GHTP │ Tên KH │ Bốc xếp │ NCC │ Hành động │
│ 1   │ Acecook VN    │ HCM - Tây…   │ HCM Tây…  │ CTY…   │ ✓       │ …   │ [✏️][🗑️]  │
│ 2   │ Aeon BT       │ HCM - An L.  │ —         │ CTY…   │ ✓       │ …   │ [✏️][🗑️]  │
└──────────────────────────────────────────────────────────────────────────┘
```

#### Cột mới

| Col | Header i18n | Width | Notes |
|-----|-------------|-------|-------|
| `diem_giao_hang_tinh_phi` | `customers.columns.diemGiaoHangTinhPhi` = “Điểm giao hàng tính phí” | `min-w-48` | `truncate` + `title` tooltip; `null`/rỗng → “—” (`text-neutral-400`); `hidden md:table-cell` |

Thứ tự cột: STT → Điểm trả hàng → **Tuyến-phường** → **Điểm giao hàng tính phí** → **Tên khách hàng** → Bốc xếp → Nhà cung cấp → Hành động.

**Ẩn cột Tuyến-cũ** trên list (không render `tuyen_cu`). Field `tuyen_cu` vẫn có trên Create/Edit và Excel import.

#### Search

- Placeholder: `customers.search` = “Tìm kiếm theo tên, điểm trả hàng, điểm GHTP…”
- Filter client: `diem_tra_hang` **hoặc** `ten_khach_hang` **hoặc** `diem_giao_hang_tinh_phi` (case-insensitive). `null` không match trừ khi query rỗng.

#### States

Không đổi: loading skeleton / empty / no results / error + retry / populated.

---

### Screen 2: CreateCustomerModal (cập nhật)

**Loại:** Modal `size="lg"`  
**Mở khi:** Thêm mới

#### Layout (field mới)

```
│ Tuyến-phường                              │
│ [textarea 2 rows                    ]     │
│                                           │
│ Điểm giao hàng tính phí                   │
│ [                                   ]     │  ← Input text, optional
│                                           │
│ [☐] Có bốc xếp                           │
```

#### Field

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `diem_giao_hang_tinh_phi` | `Input` text | Không | Optional; trim; `''` → `null`; max 255 |

- Label: `customers.fields.diemGiaoHangTinhPhi` — **không** dấu `*`
- `htmlFor` / label gắn input; `name="diem_giao_hang_tinh_phi"`; `autocomplete="off"`
- Placeholder: `customers.fields.diemGiaoHangTinhPhiPlaceholder` = “VD: HCM - Tây Thạnh…”
- Submit payload: `diem_giao_hang_tinh_phi: values.diem_giao_hang_tinh_phi?.trim() || null`

#### States

Giữ nguyên idle / submitting / inline error / 409 toast. Field mới không có required error.

---

### Screen 3: EditCustomerModal (cập nhật)

Giống Create. Prefill: `customer.diem_giao_hang_tinh_phi ?? ''`.

---

### Screen 4: DeleteCustomerDialog

Không đổi.

---

### Screen 5: UploadCustomersModal (cập nhật)

#### Column guide — thêm 1 dòng optional

```
• Điểm giao hàng tính phí (không bắt buộc; thiếu cột = để trống)
```

i18n: `customers.upload.colDiemGhtp`

#### Parse

- `findCol('Điểm giao hàng tính phí', 'diem giao hang tinh phi', 'diemgiaohangtinhphi', 'GHTP', 'ghtp')`
- Cột không có → `diem_giao_hang_tinh_phi: null` — **không** reject file
- Có cột, ô rỗng / `"null"` → `null`; có text → `trim()`

#### Template Excel

Thêm cột `Điểm giao hàng tính phí` (sau Địa chỉ giao hàng hoặc cuối, miễn header đúng tên). Dòng mẫu: giá trị ví dụ hoặc để trống.

#### Preview

Không bắt buộc hiện GHTP trên 3 dòng preview (vẫn `điểm trả hàng — tên KH`).

---

## 3. Component Checklist

| Component | File | Loại | Thay đổi |
|-----------|------|------|----------|
| CustomersPage | `frontend/src/pages/admin/accounting-data/CustomersPage.tsx` | Cập nhật | Cột: Tuyến-phường → GHTP → Tên KH; ẩn Tuyến-cũ; search |
| CreateCustomerModal | `frontend/src/components/admin/CreateCustomerModal.tsx` | Cập nhật | Field + schema + payload |
| EditCustomerModal | `frontend/src/components/admin/EditCustomerModal.tsx` | Cập nhật | Field + schema + prefill + payload |
| UploadCustomersModal | `frontend/src/components/admin/UploadCustomersModal.tsx` | Cập nhật | Guide + parse + template |
| customersApi | `frontend/src/api/customersApi.ts` | Cập nhật | Type `Customer` / `CustomerData` / `UploadCustomerRow` |
| i18n | `frontend/src/i18n/vi.json`, `en.json` | Cập nhật | Keys mục 5 |

Không tạo component mới.

### States bắt buộc (giữ)

```
- [x] Loading — skeleton table
- [x] Empty — message + CTA Thêm mới
- [x] Error — Thử lại
- [x] Success toast — create / update / delete / import
- [x] Confirm — xóa
- [x] Disabled submit khi submitting
- [ ] Empty cell GHTP — hiển thị “—”, không để ô trắng gây hiểu nhầm
```

---

## 4. Validation UX

| Trường hợp | Hiển thị | Khi nào | Message |
|------------|----------|---------|---------|
| GHTP > 255 ký tự | Inline dưới field | blur / submit | `customers.errors.diemGhtpMax` |
| GHTP trống | — | — | Hợp lệ → `null` |
| Duplicate điểm trả hàng | Toast | sau submit 409 | Giữ message cũ |
| Server 500 | Toast | sau submit | Giữ message cũ |
| Excel thiếu cột GHTP | — | parse | Không lỗi; field `null` |

---

## 5. i18n Keys cần thêm

```json
"customers.columns.diemGiaoHangTinhPhi": "Điểm giao hàng tính phí"
"customers.fields.diemGiaoHangTinhPhi": "Điểm giao hàng tính phí"
"customers.fields.diemGiaoHangTinhPhiPlaceholder": "VD: HCM - Tây Thạnh…"
"customers.search": "Tìm kiếm theo tên, điểm trả hàng, điểm GHTP…"
"customers.upload.colDiemGhtp": "Điểm giao hàng tính phí (không bắt buộc)"
"customers.errors.diemGhtpMax": "Điểm giao hàng tính phí tối đa 255 ký tự"
```

EN:

```json
"customers.columns.diemGiaoHangTinhPhi": "Chargeable delivery point"
"customers.fields.diemGiaoHangTinhPhi": "Chargeable delivery point"
"customers.fields.diemGiaoHangTinhPhiPlaceholder": "e.g. HCM - Tay Thanh…"
"customers.search": "Search by name, drop-off, or chargeable point…"
"customers.upload.colDiemGhtp": "Chargeable delivery point (optional)"
"customers.errors.diemGhtpMax": "Chargeable delivery point must be at most 255 characters"
```

Không hardcode label cột/field trên UI.

---

## 6. Web Design Guidelines Check

- Labels gắn input (`htmlFor` hoặc wrap); field optional không `*`
- Ô dài: `truncate` + `title`; flex child `min-w-0` nếu cần
- Empty: “—” không để string rỗng
- Placeholder kết thúc `…`
- `autocomplete="off"` trên field không-auth
- Icon Sửa/Xóa hiện có: giữ `title`; **nên** thêm `aria-label` khi đụng file (không block CR)
- Không `transition: all`; dark mode dùng class hiện có (`text-neutral-*` / `dark:`)
- Table overflow-x giữ `overflow-x-auto`
- Không virtualize (list đã paginate 20/trang)
