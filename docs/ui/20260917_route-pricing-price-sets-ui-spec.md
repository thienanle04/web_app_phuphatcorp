# UI Spec: Bộ giá cho giá theo tuyến

**Ngày:** 2026-09-17  
**BA Doc:** `docs/ba/20260917_route-pricing-price-sets-analysis.md`  
**Role liên quan:** `route_pricing.manage` (tạo bộ, nhập/xóa giá), `route_pricing.view` (xem)  
**Route:** sidebar **Quản lý giá cước vận tải** sổ ra 4 mục: `/route-pricing/periods` (Kỳ điều chỉnh), `/route-pricing/sets` (Bộ giá), `/route-pricing/routes` (Quản lý tuyến, giữ 2 tab Tuyến và Quản lý giá), `/route-pricing/matrix` (Bảng giá). `/route-pricing` chuyển hướng sang mục tương ứng (`?tab=` cũ vẫn được map).  
**Copy:** tiếng Việt sentence case như app hiện tại, không Title Case tiếng Anh. Dấu `…` không phải `...`.

Web Interface Guidelines đã soát vào spec này: label gắn control, lỗi inline + focus ô lỗi đầu, confirm trước xóa, toast `aria-live`, icon button có `aria-label`, giá `tabular-nums`, modal `overscroll-behavior: contain`, submit chỉ disabled khi request đã bắt đầu, `autocomplete="off"` trên tên bộ.

---

## 1. User Journey

### Happy Path — tạo bộ giá

```
Sidebar → Quản lý giá cước vận tải → Bộ giá
  → Danh sách bộ active (skeleton → data)
  → “Tạo bộ giá”
  → Modal: tên, chế độ, checkbox Pallet, các dòng bậc
  → Lưu → toast “Đã tạo bộ giá” → modal đóng → dòng mới trên danh sách
```

### Happy Path — nhập giá nhóm theo bộ

```
Sidebar → Quản lý giá cước vận tải → Quản lý tuyến → tab Quản lý giá → nhóm chưa có giá
  → “Thêm bảng giá gốc”
  → Modal: Kỳ gốc + select Bộ giá (không còn radio chế độ, không còn thêm/xóa bậc)
  → Form hiện đủ bậc của bộ (và ô Pallet nếu bộ có)
  → User nhập một số bậc, để trống bậc không dùng
  → Lưu → toast thành công → card version hiện tên bộ
  → Bảng giá: nhóm nằm trong bảng mang tên bộ; cột trống toàn book thì không có
```

### Happy Path — sửa số, bỏ một bậc

```
Card version gốc → Sửa
  → Bộ giá disabled, hiện tên
  → Prefill số đã có, ô chưa có giá để trống
  → Xóa số một bậc (ô trống) hoặc điền bậc đang trống → Lưu
  → Confirm: kỳ sau sẽ được tính lại, chỉnh tay trên kỳ sau sẽ mất
  → Toast thành công
```

### Happy Path — đổi bộ

```
Card giá → “Xóa giá”
  → Confirm: xóa hết giá mọi kỳ, nhóm tuyến giữ nguyên, không hoàn tác
  → Toast “Đã xóa giá” → card về trống
  → “Thêm bảng giá gốc” → chọn bộ khác
```

### Alternative Paths

```
- Hủy modal → đóng, không confirm
- Đổi chế độ trong modal tạo bộ → reset template bậc, không confirm
- View-only → không nút Tạo / Sửa / Xóa. Tab Bộ giá vẫn xem được
- Bộ đang có nhóm → nút Xóa disabled, tooltip “Đang có nhóm sử dụng”
- Bộ đang có nhóm → không sửa khoảng/nhãn; chỉ “Đổi tên” và “Thêm bậc”
- Book không nhóm nào thuộc một bộ → ma trận không render bảng rỗng cho bộ đó
```

### Error Paths

```
- Tên trùng / tập con / giá ≤ 0 → toast + inline dưới field, focus ô đầu, modal giữ data
- API 500 → toast “Lỗi hệ thống, thử lại”, form giữ
- Load danh sách bộ fail → text lỗi + “Thử lại”
- 401 → redirect login (interceptor hiện có)
```

---

## 2. Screen Inventory

### Screen 1: Tab Bộ giá

**Route:** `/route-pricing?tab=sets`  
**Role:** view xem; manage thêm/sửa/xóa  
**Điều kiện:** không cần chọn bảng giá (catalog global). Tab này hiện kể cả khi chưa có bảng giá.

Tab bar thêm `Bộ giá` sau `Kỳ điều chỉnh`, trước `Nhóm tuyến`:

`Kỳ điều chỉnh | Bộ giá | Nhóm tuyến | Quản lý giá | Ma trận giá`

#### Layout

```
┌──────────────────────────────────────────────────────────┐
│ Bộ giá                                  [Tạo bộ giá]     │
│ Catalog khung dùng chung. Không chứa số tiền.           │
├──────────────────────────────────────────────────────────┤
│ Tên                Chế độ        Pallet   Bậc    Việc   │
│ Tấn chuẩn + Pallet Theo trọng lượng Có    5      …      │
│ …                                                        │
└──────────────────────────────────────────────────────────┘
```

Bảng nằm trong `Card`, dùng component `Table` như hóa đơn tài xế: header xám uppercase, dòng hover, cell `px-4 py-3`. Nút “Tạo bộ giá” chỉ khi manage. Cột Hành động: icon ghost `p-1.5`, icon `w-4`, màu xám nhạt; hover xám (sửa / thêm bậc) hoặc đỏ (xóa). Có `aria-label`. Xóa disabled + `title` khi bộ đang gắn nhóm. Loading/empty/error cũng nằm trong card, căn giữa như hóa đơn tài xế.

Tên dài: `truncate` + `title` full text. Cột số bậc dùng `tabular-nums`.

#### States

| State | Trigger | UI |
|-------|---------|----|
| Loading | Fetch | Card, skeleton 5 dòng `h-10`. “Đang tải…” cho screen reader |
| Empty | `[]` | Card, “Chưa có bộ giá” căn giữa + CTA “Tạo bộ giá” nếu manage |
| Error | API fail | Card, icon cảnh báo + “Không tải được danh sách bộ giá” + “Thử lại” |
| Populated | Có data | Bảng |

#### Actions

| Action | Trigger | Kết quả |
|--------|---------|---------|
| Tạo | Nút header | Modal Screen 2, mode tạo |
| Đổi tên | Icon bút | Modal Screen 3 |
| Thêm bậc | Icon | Modal Screen 4 |
| Xóa | Icon thùng | Confirm rồi DELETE. Toast “Đã ngừng dùng bộ giá” |

---

### Screen 2: Modal Tạo / sửa cấu trúc bộ giá

**Loại:** Modal `size="xl"`, `overscroll-behavior: contain`  
**Mở khi:** Tạo, hoặc sửa cấu trúc khi bộ **chưa** có nhóm  
**Role:** manage

#### Layout

```
┌─────────────────────────────────────────────────────────┐
│ Tạo bộ giá / Sửa bộ giá                             [X] │
├─────────────────────────────────────────────────────────┤
│ Tên *                                                   │
│ [________________________________]                      │
│                                                         │
│ Chế độ *                                                │
│ ( ) Theo trọng lượng                                    │
│ ( ) Theo số chuyến/xe/ngày                              │
│ ( ) Theo loại xe                                        │
│                                                         │
│ [ ] Có giá pallet                                       │
│                                                         │
│ Bậc *                                                   │
│  Mỗi bậc là một thẻ (cùng layout nhập giá cũ):         │
│  weight: Đơn vị | Từ (tấn) | Đến (tấn) | Tối thiểu    │
│          (nếu Tấn) | xóa                                │
│          Template sẵn 5 bậc (0–2,5 chuyến, …, >23)     │
│  trips: Từ (≥) [ô] đến (≤) [ô] trên một dòng; cuối đến (∞) khóa │
│          Tự nối from = to trước + 1. Template 2 bậc    │
│  truck: Nhãn loại xe | Đơn vị | xóa                    │
│  [+ Thêm bậc]  [xóa, aria-label “Xóa bậc”, khóa khi 1] │
│                                                         │
│ Hint: Bộ giá chỉ là khung. Số tiền nhập ở từng nhóm.   │
├─────────────────────────────────────────────────────────┤
│                              [Hủy]  [Lưu bộ giá]        │
└─────────────────────────────────────────────────────────┘
```

Không field giá. Checkbox “Có giá pallet” là slot, default off. Radio và checkbox cùng hit target với label. Tên có `name`, `autocomplete="off"`, `spellCheck={false}`. Placeholder `VD: Tấn chuẩn + Pallet…`.

Đổi radio: reset template bậc của chế độ mới, không confirm. Đóng modal cũng không confirm.

Sửa cấu trúc (bộ chưa ai dùng): prefill, cho sửa range/nhãn/xóa dòng/cờ pallet. List không hiện sửa cấu trúc nếu bộ đang được gắn — chỉ Đổi tên và Thêm bậc.

#### States

| State | UI |
|-------|----|
| Default tạo | Tên trống, mode weight, pallet off, 1 dòng bậc trống |
| Edit cấu trúc | Prefill |
| Submitting | Nút “Đang lưu…” disabled + spinner, form lock |
| Lỗi field | Inline dưới field, focus ô đầu |
| Success | Đóng, refresh list, toast |

---

### Screen 3: Modal Đổi tên

**Loại:** Modal nhỏ  
**Fields:** Tên * (prefill)  
**Actions:** Hủy / Lưu tên  
**Lỗi:** inline “Tên bộ giá đã tồn tại”

---

### Screen 4: Modal Thêm bậc

**Loại:** Modal nhỏ  
**Mở khi:** thêm một bậc vào bộ đã có (kể cả bộ đang được nhóm dùng)  
**Fields:** một dòng bậc đúng mode của bộ. Không đổi mode. Không bật/tắt pallet ở đây.  
**Hint:** “Nhóm đang dùng bộ này chưa có giá cho bậc mới cho đến khi được nhập.”  
**Success toast:** “Đã thêm bậc”

---

### Screen 5: Modal Thêm / Sửa bảng giá gốc (thay form hiện tại)

**Loại:** Modal `size="lg"`  
**Route:** tab Quản lý giá  
**Mở khi:** nhóm chưa có giá (thêm) hoặc sửa version gốc (sửa)

#### Layout

```
┌─────────────────────────────────────────────────────────┐
│ Thêm bảng giá gốc / Sửa bảng giá gốc                [X] │
├─────────────────────────────────────────────────────────┤
│ Kỳ gốc *          (chỉ khi thêm)                        │
│ Bộ giá *          [Select — disabled khi sửa]          │
│                                                         │
│ Pallet            [______]              (nếu bộ có)    │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Bậc [≤2,5 tấn]  Đơn vị [vnđ/chuyến]  Đơn giá [___] │ │
│ │ Bậc [>2,5–8 tấn (cước tối thiểu 5 tấn)]            │ │
│ │                 Đơn vị [vnđ/tấn]     Đơn giá [___] │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Hint: Để trống bậc nhóm không dùng. Không nhập 0.      │
├─────────────────────────────────────────────────────────┤
│                              [Hủy]  [Lưu]               │
└─────────────────────────────────────────────────────────┘
```

Bỏ radio chế độ, bỏ “+ Thêm bậc”, bỏ nút xóa dòng. Select bộ chỉ bộ active. Đổi bộ trước lần lưu đầu thì reset ô giá, confirm nếu đã nhập số.

Mỗi bậc là một thẻ cùng layout modal điều chỉnh kỳ: Bậc và Đơn vị khóa, ô Đơn giá nhập được. Không placeholder trong ô Đơn giá. Cước tối thiểu nằm trong nhãn bậc. Pallet (nếu bộ có) là một ô đơn phía trên các thẻ.

Ô giá: `type="number"`, `inputmode="decimal"`, `autocomplete="off"`, label `htmlFor`, không placeholder. Trống hợp lệ. `0` hoặc âm: inline “Giá phải lớn hơn 0”.

Sửa: select bộ disabled. Không đổi bộ trên modal này. Muốn đổi: đóng modal, dùng “Xóa giá”.

#### States

| State | UI |
|-------|-----|
| Thêm, chưa chọn bộ | Không hiện dòng bậc |
| Đã chọn bộ | Đủ dòng bậc |
| Sửa | Prefill, bộ khóa |
| Submitting | “Đang lưu…” |
| Success | Đóng, refresh card |

Nút Lưu enabled khi đã chọn bộ, kể cả khi còn ô trống. Disable chỉ lúc request đang chạy.

Trước khi lưu sửa giá gốc: confirm “Các kỳ sau sẽ được tính lại. Chỉnh tay trên kỳ sau sẽ mất.”

---

### Screen 6: Card giá nhóm (cập nhật)

Trên tab Quản lý giá, card version thêm dòng **Bộ giá: {tên}**. Badge mode đọc từ bộ.

Nút manage:

- “Xóa giá” (danger): confirm “Xóa hết giá của nhóm này ở mọi kỳ? Nhóm tuyến vẫn còn. Không hoàn tác từ giao diện.”
- “Sửa” giá gốc như Screen 5
- “Điều chỉnh giá” trên card một kỳ: modal hiện đủ bậc của bộ. Bậc đã có giá: nhãn và đơn vị khóa, ô Đơn giá bắt buộc, không xóa trắng. Bậc chưa có giá: cùng thẻ, ô Đơn giá để trống, không placeholder. Pallet hiện nếu bộ có slot: kỳ đã có pallet thì bắt buộc; kỳ chưa có thì để trống hoặc nhập số để áp dụng từ kỳ này. Bộ không có pallet thì không hiện ô Pallet. Copy: “Chỉ sửa đơn giá. Các kỳ sau sẽ được tính lại theo % của từng kỳ (làm tròn nghìn).” và “Muốn bỏ bậc hoặc pallet đã có, sửa giá gốc và để trống. Bậc hoặc pallet chưa có giá: để trống nếu nhóm vẫn không dùng, hoặc nhập số để áp dụng từ kỳ này.”

Giá `tabular-nums`. Không hiện `0` cho pallet vắng.

---

### Screen 7: Tab Ma trận giá (cập nhật)

**Giữ:** select bảng giá, select “Từ kỳ”, header 3 tầng (kỳ / nhãn bậc / đơn vị), màu kỳ, ô chỉnh tay amber, sticky STT + Tuyến, scroll `max-h-[70vh]`.

**Đổi:**

- Một section = một bộ giá có ít nhất một nhóm trong book. Tiêu đề = tên bộ.
- Không còn tách nhiều bảng weight theo fingerprint.
- Không còn bảng trips “một dòng một bậc”. Trips, truck, weight dùng cùng component bảng.
- Cột dưới mỗi kỳ = bậc của bộ mà có ít nhất một nhóm trong book có giá ở bất kỳ kỳ. Pallet là cột cuối nếu có nhóm có pallet.
- Ô không record: `-`.
- Nhóm chưa có giá không lên bảng.
- Bảng dài: giữ scroll container `max-h-[70vh]`. Không thêm `content-visibility` và không thêm thư viện virtualize.

Thứ tự bảng: `by_weight`, rồi `by_truck`, rồi `by_trips`, trong mỗi mode theo tên bộ.

#### States

| State | UI |
|-------|-----|
| Loading | Skeleton như tab hiện tại |
| Book không nhóm có giá | “Chưa có giá trong bảng giá này” |
| Error | “Không tải được ma trận” + Thử lại |
| Populated | Một hoặc nhiều bảng bộ giá |

Ma trận vẫn read-only.

---

## 3. Component Checklist

| Component | File | Loại | Dùng ở |
|-----------|------|------|--------|
| Tab Bộ giá | `frontend/src/pages/route-pricing/PriceSetsTab.tsx` | Mới | Screen 1 |
| Modal bộ giá | `frontend/src/pages/route-pricing/PriceSetFormModal.tsx` | Mới | Screen 2–4 |
| Modal giá nhóm | `frontend/src/pages/route-pricing/PriceFormModal.tsx` | Cập nhật | Screen 5 |
| Card giá | `RoutePricingPage.tsx` | Cập nhật | Screen 6 |
| Ma trận | `PriceMatrixTab.tsx` | Cập nhật | Screen 7 |
| API / hooks | `routePricingApi.ts`, `useRoutePricing.ts` | Cập nhật | Tất cả |

```
- [ ] Loading — skeleton, chữ kết thúc bằng …
- [ ] Empty — có CTA nếu manage
- [ ] Error — message + Thử lại
- [ ] Toast success/error sau create / update / delete
- [ ] Confirm trước xóa bộ, xóa giá. Đổi chế độ và hủy modal tạo bộ không confirm
- [ ] Submit enabled đến khi request bắt đầu, rồi “Đang lưu…”
- [ ] Icon-only button có aria-label; icon trang trí aria-hidden
- [ ] Focus-visible không bị outline-none trần
- [ ] Không hardcode string — i18n vi + en
```

---

## 4. Validation UX

| Trường hợp | Hiện ở đâu | Khi | Message |
|------------|------------|-----|---------|
| Tên trống | Inline | Blur / submit | “Nhập tên bộ giá” |
| Tên trùng | Inline + toast | Sau API 409 | “Tên bộ giá đã tồn tại” |
| Tập con / trùng khung | Toast | Sau API 400 | “Khung này đã nằm trong bộ giá khác. Dùng bộ đủ và để trống bậc không cần.” |
| Chưa chọn bộ khi lưu giá | Inline select | Submit | “Chọn bộ giá” |
| Giá ≤ 0 | Inline ô | Blur / submit | “Giá phải lớn hơn 0” |
| Bậc đã có giá để trống khi sửa kỳ | Inline ô | Submit | “Nhập đơn giá” |
| Bậc chưa có giá để trống khi sửa kỳ | Không lỗi | Submit | Giữ không áp dụng |
| Bậc chưa có giá nhập ≤ 0 | Inline ô | Submit | “Giá phải lớn hơn 0” |
| Không ô nào có giá | Toast | Submit | “Nhập ít nhất một bậc” |
| Đổi bộ khi đã có giá | Không có control | — | Dùng “Xóa giá” |
| Xóa bộ đang dùng | Nút disabled | — | Tooltip “Đang có nhóm sử dụng” |
| 500 | Toast | Sau submit | “Lỗi hệ thống, vui lòng thử lại” |
| 401 | Redirect login | Interceptor | — |

Focus ô lỗi đầu sau submit.

---

## 5. i18n Keys cần thêm

```
routePricing.tab.sets = "Bộ giá"
routePricing.priceSet.title = "Bộ giá"
routePricing.priceSet.subtitle = "Catalog khung dùng chung. Không chứa số tiền."
routePricing.priceSet.create = "Tạo bộ giá"
routePricing.priceSet.empty = "Chưa có bộ giá"
routePricing.priceSet.loading = "Đang tải…"
routePricing.priceSet.loadError = "Không tải được danh sách bộ giá"
routePricing.priceSet.retry = "Thử lại"
routePricing.priceSet.name = "Tên *"
routePricing.priceSet.namePlaceholder = "VD: Tấn chuẩn + Pallet…"
routePricing.priceSet.nameRequired = "Nhập tên bộ giá"
routePricing.priceSet.duplicate = "Tên bộ giá đã tồn tại"
routePricing.priceSet.subset = "Khung này đã nằm trong bộ giá khác. Dùng bộ đủ và để trống bậc không cần."
routePricing.priceSet.hasPallet = "Có giá pallet"
routePricing.priceSet.hint = "Bộ giá chỉ là khung. Số tiền nhập ở từng nhóm."
routePricing.priceSet.save = "Lưu bộ giá"
routePricing.priceSet.saving = "Đang lưu…"
routePricing.priceSet.rename = "Đổi tên"
routePricing.priceSet.addTier = "Thêm bậc"
routePricing.priceSet.addTierHint = "Nhóm đang dùng bộ này chưa có giá cho bậc mới cho đến khi được nhập."
routePricing.priceSet.delete = "Ngừng dùng"
routePricing.priceSet.deleteInUse = "Đang có nhóm sử dụng"
routePricing.priceSet.confirmDelete = "Ngừng dùng bộ giá “{name}”?"
routePricing.priceSet.discard = "Bỏ thay đổi?"
routePricing.priceSet.switchMode = "Đổi chế độ sẽ xóa các bậc đang nhập. Tiếp tục?"

routePricing.price.pickSet = "Bộ giá *"
routePricing.price.pickSetRequired = "Chọn bộ giá"
routePricing.price.blankHint = "Để trống bậc nhóm không dùng. Không nhập 0."
routePricing.price.atLeastOne = "Nhập ít nhất một bậc"
routePricing.price.pricePositive = "Giá phải lớn hơn 0"
routePricing.price.setLocked = "Muốn đổi bộ giá, xóa giá rồi nhập lại."
routePricing.price.confirmRecascade = "Các kỳ sau sẽ được tính lại. Chỉnh tay trên kỳ sau sẽ mất."
routePricing.price.delete = "Xóa giá"
routePricing.price.confirmDelete = "Xóa hết giá của nhóm này ở mọi kỳ? Nhóm tuyến vẫn còn. Không hoàn tác từ giao diện."
routePricing.price.periodNoRemoveTier = "Muốn bỏ bậc hoặc pallet đã có, sửa giá gốc và để trống. Bậc hoặc pallet chưa có giá: để trống nếu nhóm vẫn không dùng, hoặc nhập số để áp dụng từ kỳ này."
routePricing.manage.confirmAdd = "thêm"

routePricing.matrix.emptyBook = "Chưa có giá trong bảng giá này"
routePricing.matrix.emptyCell = "-"

routePricing.message.success.createSet = "Đã tạo bộ giá"
routePricing.message.success.renameSet = "Đã đổi tên bộ giá"
routePricing.message.success.addTier = "Đã thêm bậc"
routePricing.message.success.deleteSet = "Đã ngừng dùng bộ giá"
routePricing.message.success.deletePrices = "Đã xóa giá"
routePricing.message.error.generic = "Lỗi hệ thống, vui lòng thử lại"
```

Keys `en.json` cùng key, bản dịch tiếng Anh ngắn. Không để string trong JSX.

---

## 6. Guidelines — điểm đã nhúng / không làm trong CR

- Nhúng: label, aria-label icon, confirm destructive, inline error, focus first error, `…`, tabular-nums, overscroll modal, autocomplete off, submit-then-disable, empty/error/loading, i18n, ô trống `-`.
- Không virtualize thư viện mới và không thêm `content-visibility`: ma trận đã scroll trong `max-h-[70vh]`.
- Không đổi copy app sang Title Case.
- Không `autoFocus` cả modal; focus tên khi mở tạo bộ (một field), focus ô lỗi sau submit.
