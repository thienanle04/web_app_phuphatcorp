# UI Spec: Phụ phí giao hàng

**Ngày:** 2026-09-17  
**BA Doc:** `docs/ba/20260917_customer-surcharges-analysis.md`  
**Role liên quan:** `route_pricing.view` (xem, tra cứu), `route_pricing.manage` (thêm, đổi giá, ngừng, xóa)  
**Phạm vi UI:** trang mới `/route-pricing/surcharges`, mục sidebar, delta màn khách hàng

**Web Interface Guidelines (self-check trước khi lưu):**

- Nút icon-only (Đổi giá, Ngừng, Xóa) bắt buộc `aria-label`. Icon trang trí `aria-hidden`.
- Mọi input/select có `label` gắn `htmlFor`. `autocomplete="off"` vì không phải form đăng nhập. Không chặn paste.
- Modal: `overscroll-behavior: contain`. Không `window.confirm`. Confirm ngừng và confirm xóa là modal riêng.
- Số tiền và ngày: `tabular-nums` + `Intl.NumberFormat` / `Intl.DateTimeFormat`. Không hardcode format.
- Submit disabled chỉ khi request đã bắt đầu, kèm spinner. Text loading kết thúc bằng `…`.
- Lỗi field: inline, focus ô lỗi đầu tiên khi submit. Lỗi API: toast, form không mất data. Toast `aria-live="polite"`.
- Filter và tab nằm trên URL. Link sang trang này là thẻ `a`, không phải `div` click.
- Tên và địa chỉ dài: `truncate` + `title`. Flex item có text dài cần `min-w-0`.
- Form dirty: hỏi trước khi đóng hoặc rời trang. Placeholder kết thúc bằng `…`.
- Không animation ngoài hover. Nếu có transition thì liệt kê property, không `transition: all`, và tôn `prefers-reduced-motion`.
- Danh sách phân trang 50 dòng, không render cả catalog không cắt.
- Focus visible không bị `outline-none` nuốt. Heading trang là `h1`.

---

## 1. User Journey

### Happy Path — thêm giá đại lý rồi tra cứu

```
Sidebar → Quản lý giá cước vận tải → Phụ phí giao hàng
  → Trang danh sách (skeleton → bảng, mặc định chỉ dòng đang mở)
  → User manage bấm “Thêm phụ phí”
  → Modal: tick một hoặc nhiều tên khách, loại phí, vùng, khung xe, số tiền, ngày bắt đầu
  → Lưu → toast thành công → modal đóng → phụ phí mới trên bảng
  → Bấm “Tra cứu”
  → Nhập đúng tên, địa chỉ, vùng, khung xe, ngày
  → Thấy điểm khớp (nếu có) và ba dòng kết quả, đơn giá không bị nhân với tấn
```

### Happy Path — giá riêng một cửa hàng

```
Thêm phụ phí → tick đúng một tên khách → chọn “Chi nhánh cụ thể”
  → Ô điểm chỉ hiện điểm của tên đó mà có địa chỉ
  → Mỗi option: “tên nhà cung cấp - điểm trả (địa chỉ)”
  → Chọn điểm → lưu
  → Bảng có cột Nhà cung cấp ngay trước Điểm trả. Tên lấy lúc đọc, không lưu trên rule
```

### Happy Path — đổi giá

```
Dòng đang mở → Đổi giá
  → Số tiền và ngày bắt đầu sửa được. Loại phí, vùng, khung xe, khách chỉ đọc
  → Ngày mới sau ngày bắt đầu cũ → Lưu
  → Dòng cũ biến khỏi bộ lọc “Đang mở”. Bộ lọc “Tất cả” thấy dòng cũ đã đóng và dòng mới
```

### Alternative Paths

```
- Hủy modal hoặc X khi form chưa sửa → đóng, không hỏi
- Hủy khi form đã sửa → modal “Bỏ thay đổi?”. Ở lại thì giữ số đang nhập
- User chỉ có view → không thấy Thêm / Đổi giá / Ngừng / Xóa. Vẫn Tra cứu
- Tick từ hai tên: ẩn Phạm vi và Điểm trả, bỏ điểm đang chọn. Bỏ về một tên thì hiện lại, điểm trống
- Không có “chọn tất cả”. Bỏ lọc tên không làm mất các tên đã tick. Ô gõ có biểu tượng X để xóa chữ. Tên đã chọn có biểu tượng X để bỏ, bấm tên không bỏ
- Từ danh sách khách, bấm tên đại lý (chỉ khi có route_pricing.view) → sang trang này với lọc tên sẵn
- Ngừng: confirm, ngày ngừng mặc định hôm nay, đổi được. Hủy confirm → không đóng rule
- View-only mở URL thêm/sửa → không có nút, không mở modal ghi
```

### Error Paths

```
- Load danh sách fail → text lỗi + Thử lại. Không bảng trống giả
- Tạo bị từ chối theo tên → danh sách lỗi trong form, không toast. Tên đã tick giữ nguyên. Sửa rồi lưu lại
- Submit 500, hoặc lỗi đổi giá / ngừng → toast tiếng Việt, modal liên quan vẫn mở
- 401 → redirect đăng nhập
- Tra cứu thiếu field → inline, không gọi API
- Hai điểm cùng địa chỉ, chưa nhập mã → AMBIGUOUS, nhắc nhập mã nhà cung cấp
- Đã nhập mã mà vẫn hai điểm cùng mã → AMBIGUOUS, không nhắc nhập mã lần nữa
- Mã không khớp điểm nào → “Không khớp điểm”. Phí rơi về đại lý, không lấy điểm của mã khác
```

---

## 2. Screen Inventory

### Screen 1: Danh sách phụ phí

**Route:** `/route-pricing/surcharges`  
**Role:** `route_pricing.view` hoặc `manage`. Không quyền → không thấy menu, vào URL thì redirect theo guard hiện có của giá cước.  
**Query:** `tenKhachHang`, `feeType`, `zone`, `vehicleClass`, `status` (`open` mặc định, `closed`, `all`), `page`. Đổi filter thì `page` về 1. `tenKhachHang` lọc theo đoạn trong tên, không phân biệt hoa thường và dấu. Ô tên giữ chữ ngay, chờ một nhịp rồi mới ghi URL và tải lại. Link từ danh sách khách vẫn gửi đủ tên.

#### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ h1 Phụ phí giao hàng                          [Tra cứu] [Thêm]       │
│ Giá theo khách. Không nằm trên bảng giá tuyến.                       │
├──────────────────────────────────────────────────────────────────────┤
│ [Tên khách hàng ▾] [Loại phí ▾] [Vùng ▾] [Khung xe ▾] [Trạng thái ▾] │
├──────────────────────────────────────────────────────────────────────┤
│ DataGrid: Khách (ghim, kèm Điểm trả hàng) | Phạm vi |             │
│ Loại phí | Vùng | Khung xe | Đơn giá | Hiệu lực từ | [Đến]      │
│                                                    [✎][⊘][⌫]      │
├──────────────────────────────────────────────────────────────────────┤
│ Phân trang 50 (footer của DataGrid)                                  │
└──────────────────────────────────────────────────────────────────────┘
```

Thêm chỉ khi `manage`. Tra cứu khi có view.

Danh sách dùng `DataGrid` (`frontend/src/components/ui/DataGrid.tsx`), không dùng `Table`. Cột Khách ghim trái. Header dính khi cuộn dọc. Tên dài thì cắt đầu, giữ phần cuối, tooltip đủ chữ. Không `title`. Phân trang nằm trong `footer` của lưới, chỉ khi có dòng.

Tiêu đề cột đơn giá là “Đơn giá”, không kèm đơn vị tiền. Tiêu đề và số đều căn trái, `tabular-nums`, `Intl.NumberFormat` vi-VN. Đơn vị “đồng/tấn” hoặc “đồng/chuyến” nằm cùng ô, chữ phụ, không dính vào số. Không hiện mã `tan` / `chuyen`. Form vẫn dùng “Đơn giá (đồng)”.

Cột ngày trên lưới là “Hiệu lực từ”. Lọc Đang mở thì không có cột Đến. Lọc Đã đóng hoặc Tất cả thì thêm cột Đến; dòng chưa ngừng hiện “—”. Form và hộp thoại ngừng vẫn dùng “Ngày bắt đầu” / “Ngày ngừng”.

Vùng trống trên rule hiện “Mọi vùng”. Khung xe trống hiện “Mọi khung xe”.

Phạm vi: “Đại lý” nếu `customer_id` null, ngược lại “Điểm trả”.

Cột Khách hàng (`customer`):
- Hiển thị tên khách hàng ở dòng trên (kèm badge “Đã ngừng” nếu khách deactive).
- Nếu dòng có điểm trả hàng: hiển thị thêm dòng dưới với icon MapPin nhỏ và chuỗi “NCC - Điểm trả hàng” (hoặc chỉ tên điểm nếu không có mã NCC), cắt ngắn kèm tooltip xem đầy đủ. Nếu là phụ phí cả đại lý thì không hiện dòng điểm.
- Bỏ cột Điểm trả hàng riêng biệt trên bảng, giúp bảng gọn gàng và không gian các cột cân đối.

#### States

| State | Trigger | UI hiển thị |
|-------|---------|-------------|
| Loading | Đang fetch | Skeleton bảng, không spin cả trang |
| Empty | 0 dòng sau lọc | “Chưa có phụ phí” + nút Thêm nếu manage |
| Empty filter | Có data nhưng lọc rỗng | “Không có dòng khớp bộ lọc” + nút Xóa lọc. Không nút Thêm thay cho xóa lọc |
| Error | API fail | Dòng lỗi + Thử lại |
| Populated | Có dòng | DataGrid + phân trang trong footer |
| View-only | Không manage | Không cột hành động, không Thêm |

#### Actions

| Action | Trigger | Kết quả |
|--------|---------|---------|
| Thêm phụ phí | Nút, manage | Screen 2, form trống |
| Đổi giá | Nút icon Pencil, `aria-label` “Đổi giá”, chỉ dòng đang mở, manage | Screen 3 |
| Ngừng | Nút icon, `aria-label` “Ngừng áp dụng”, chỉ dòng đang mở, manage | Screen 4 |
| Xóa | Nút icon, `aria-label` “Xóa phụ phí”, mọi dòng user thấy, manage | Screen 9 |
| Tra cứu | Nút | Screen 5 |
| Đổi lọc | Select | Ghi URL, refetch |
| Xóa lọc | Nút text | Xóa query trừ `status=open` |

Xóa cứng từng phụ phí, có confirm. Không sửa số tiền ngay trên bảng. Phụ phí đã ngừng không có Đổi giá và Ngừng, vẫn có Xóa.

---

### Screen 2: Modal Thêm phụ phí

**Loại:** Modal `size="lg"`  
**Mở khi:** Thêm phụ phí  
**Role:** manage

#### Layout

```
┌─────────────────────────────────────────────┐
│ Thêm phụ phí                            [X] │
├─────────────────────────────────────────────┤
│ Tên khách hàng *                            │
│ [Gõ để lọc, tick nhiều tên, không chọn tất] │
│ Tên đã chọn hiện dưới ô, full width, góc vuông, X bên phải. │
│                                             │
│ Phạm vi *     ẩn khi đã tick từ hai tên     │
│ ( ) Toàn hệ thống   ( ) Chi nhánh cụ thể    │
│                                             │
│ Chi nhánh *         chỉ khi “Chi nhánh cụ thể” │
│ [NCC và điểm trả nổi, địa chỉ mờ       ]    │
│                                             │
│ Loại phí *                                  │
│ [Bốc xếp | Phụ phí giao hàng | Chuyển tải]  │
│                                             │
│ Vùng                    Khung xe            │
│ [Mọi vùng ▾]            [Mọi khung xe ▾]    │
│                                             │
│ Đơn giá (đồng) *        Ngày bắt đầu *      │
│ [0              ]       [date            ]  │
│ Đơn vị hiện chữ, không cho sửa: đồng/tấn    │
│ hoặc đồng/chuyến                            │
├─────────────────────────────────────────────┤
│ [Hủy]                         [Lưu phụ phí] │
└─────────────────────────────────────────────┘
```

Đơn vị đổi theo loại phí, read-only. Bốc xếp → đồng/tấn. Hai loại kia → đồng/chuyến. Ghi một dòng dưới ô đơn giá: “Tra cứu trả đơn giá, không nhân với số tấn.”

Ô tên là dropdown bo tròn, không đẩy form xuống. Mở ra có ô tìm trong panel. Chưa gõ thì panel không liệt kê tên. Có chữ thì hiện X để xóa chữ lọc, danh sách kết quả nằm trong panel. Tick không đóng dropdown. Không “chọn tất cả”. Không submit tên không có trong options. Đóng panel không xóa tên đã tick. Tên đã chọn nằm dưới ô, full width, góc vuông, chỉ bỏ bằng biểu tượng X bên phải. Chưa tick tên nào thì không gọi API.

Đúng một tên: hiện Phạm vi. Chi nhánh chỉ khi “Chi nhánh cụ thể”, lọc theo tên đó, chỉ điểm có địa chỉ. Đổi tên thì xóa điểm đang chọn. Từ hai tên: ẩn Phạm vi và Chi nhánh, xóa điểm đang chọn, lưu giá đại lý.

Ô đã chọn vẫn một dòng, `truncate`: `tên nhà cung cấp - điểm trả (địa chỉ)`. Không có tên thì dùng mã. Không có cả hai thì `điểm trả (địa chỉ)`. Trong danh sách mở, NCC và điểm trả hàng ở dòng trên, chữ đậm. Địa chỉ xuống dòng dưới, chữ mờ, nhỏ hơn. Tên lấy lúc mở form, không snapshot lên rule. Gõ tên nhà cung cấp hoặc địa chỉ vẫn lọc được vì chữ nằm trong label. Không cảnh báo khi hai điểm trùng địa chỉ.

Placeholder tên: “Chọn khách…”. Placeholder chi nhánh: “Chọn chi nhánh…”.

`inputMode="numeric"` trên đơn giá. Không dấu thập phân. `name` có trên mọi control. Radio phạm vi: label và control cùng một hit target.

Khi tạo bị từ chối theo tên, khối lỗi nằm trên nút Lưu, `aria-live="polite"`:

```
Không lưu được
Bách Hóa Xanh — Đã có phụ phí đang mở cùng điều kiện
```

Lý do đúng bốn câu, không dùng chữ “dòng”:

| `code` | Câu |
|--------|-----|
| `RULE_OPEN_EXISTS` | Đã có phụ phí đang mở cùng điều kiện |
| `RULE_OVERLAP` | Ngày bắt đầu chồng với phụ phí đã ngừng |
| `RULE_AMBIGUOUS` | Trùng điều kiện với phụ phí khác, không biết lấy giá nào |
| `CUSTOMER_NAME_UNKNOWN` | Tên không còn trong khách đang hoạt động |

#### States

| State | Trigger | UI hiển thị |
|-------|---------|-------------|
| Default | Mở mới | Phạm vi “Toàn hệ thống”. Ngày bắt đầu = hôm nay. Đơn giá trống. Lưu enabled |
| Điểm | Đúng một tên và phạm vi điểm | Combobox điểm hiện. Không chọn điểm thì không gọi API |
| Nhiều tên | Đã tick từ hai tên | Ẩn Phạm vi và Chi nhánh |
| Submitting | Bấm Lưu | Nút disabled + “Đang lưu…”. Form khóa |
| Lỗi theo tên | 400/409 có `failures` | Form mở, data giữ, không toast. Danh sách trong form, đúng thứ tự tên đang tick. Mỗi mục: tên + lý do |
| Lỗi khác | 500, hoặc 400 không có `failures` | Toast, form mở, data giữ |
| Submit success | 201, một tên | Toast “Đã thêm phụ phí”, đóng modal, refresh list |
| Submit success, nhiều tên | 201, từ hai tên | Toast “Đã thêm {n} phụ phí”, đóng modal, refresh list |
| Dirty close | X hoặc Hủy khi đã sửa | Screen 2b |

---

### Screen 2b: Bỏ thay đổi

**Loại:** Modal nhỏ, đè lên form  
**Mở khi:** đóng Screen 2 hoặc 3 khi dirty

Nội dung: “Bỏ thay đổi?”. Nút “Ở lại” và “Bỏ”. Không `window.confirm`. Ở lại thì focus về form.

---

### Screen 3: Modal Đổi giá

**Loại:** Modal `size="lg"`  
**Mở khi:** Đổi giá trên dòng đang mở  
**Role:** manage

Cùng field Screen 2. Khách, phạm vi, điểm, loại phí, vùng, khung xe là text đọc, không phải input. Điểm đọc bằng cùng chuỗi option: `tên nhà cung cấp - điểm trả (địa chỉ)`, hoặc mã nếu không có tên, hoặc chỉ `điểm trả (địa chỉ)`. Chỉ Đơn giá và Ngày bắt đầu sửa được.

Ngày bắt đầu prefill trống, không prefill ngày cũ. Helper: “Ngày mới phải sau {ngày bắt đầu hiện tại}.”

Lưu gọi replace, không update tại chỗ. Thành công: toast “Đã đổi giá”.

Không có nút Đổi giá trên dòng đã đóng.

---

### Screen 4: Ngừng áp dụng

**Loại:** Modal confirm  
**Mở khi:** Ngừng  
**Role:** manage

```
Ngừng phụ phí này?
{Khách} · {loại phí} · {vùng hoặc Mọi vùng} · {khung xe hoặc Mọi khung xe}
Đơn giá {số}

Ngày ngừng *   [date, mặc định hôm nay]

Sau ngày này rule không còn dùng. Nếu đây là giá riêng cửa hàng,
các ngày sau lấy giá đại lý khi đại lý còn rule.

[Hủy]                      [Ngừng áp dụng]
```

Nút ngừng không phải màu primary. Không đóng ngay khi bấm. Submitting thì disabled + “Đang ngừng…”.

Ngày ngừng trước ngày bắt đầu: inline, không gọi API.

Thành công: toast “Đã ngừng phụ phí”.

Ngừng không xóa phụ phí. Không có nút Ngừng trên phụ phí đã ngừng.

---

### Screen 9: Xóa phụ phí

**Loại:** Modal confirm  
**Mở khi:** Xóa, trên phụ phí đang mở hoặc đã ngừng  
**Role:** manage

Luôn hỏi. Không `window.confirm`. Nút xác nhận không phải màu primary. Không đóng ngay khi bấm. Submitting: disabled + “Đang xóa…”. Hủy thì không gọi API.

Ba câu, không dùng chữ “dòng”:

Đang mở, không có phụ phí cũ cùng điều kiện:

```
Xóa phụ phí này?
Sau khi xóa, tra cứu sẽ không còn phụ phí này.

[Hủy]                      [Xóa phụ phí]
```

Đang mở, còn phụ phí cũ đã ngừng. Giá đại lý:

```
Xóa phụ phí đang áp dụng?
Phụ phí cũ không được mở lại. Sau ngày kết thúc của phụ phí cũ, tra cứu không còn phụ phí này.
```

Giá một điểm trả: cùng câu trên, thêm “Nếu điểm không còn phụ phí đang áp dụng cùng loại, tra cứu lấy giá đại lý.”

Đã ngừng:

```
Xóa phụ phí đã ngừng?
Tra cứu các ngày mà phụ phí này đang khớp sẽ không còn ra số này.
```

Thành công: toast “Đã xóa phụ phí”, refresh list. 404: toast, không còn hàng đó sau khi refresh.

---

### Screen 5: Modal Tra cứu

**Loại:** Modal `size="lg"`  
**Mở khi:** Tra cứu  
**Role:** view

#### Layout

```
┌──────────────────────────────────────────────┐
│ Tra cứu phụ phí                          [X] │
├──────────────────────────────────────────────┤
│ Tên khách hàng *     đây là text, không bắt  │
│ [                          ]  spellCheck off │
│ phải chọn từ danh sách. Tra cứu dùng chuỗi   │
│ chuyến gửi lên.                              │
│                                              │
│ Địa chỉ giao hàng *                          │
│ [textarea 2 dòng                          ]  │
│                                              │
│ Mã nhà cung cấp                              │
│ [text, không bắt buộc, spellCheck off     ]  │
│                                              │
│ Vùng *          Khung xe *       Ngày *      │
│ [Nội thành ▾]   [≤2.5 tấn ▾]     [date]      │
│                                              │
│ [Tra cứu]                                    │
├──────────────────────────────────────────────┤
│ Kết quả                                      │
│ Điểm trả hàng          …                     │
│ Tuyến - phường         …                     │
│ Điểm giao hàng tính phí …                    │
│                                              │
│ Loại phí | Đơn giá | Đơn vị | Nguồn | Kết quả│
│ Bốc xếp  | 200.000 | đồng/tấn | Đại lý | Khớp│
│ …                                            │
└──────────────────────────────────────────────┘
```

Vùng và khung xe trên tra cứu bắt buộc, không có “Mọi…”. Ngày mặc định hôm nay.

Ô mã nhà cung cấp không bắt buộc. `name="supplier_code"`, `autocomplete="off"`, `spellCheck={false}`, `translate="no"`. Placeholder “VD: 2000000007…”. Để trống hoặc chỉ khoảng trắng thì không gửi mã. Không phải combobox. Không gắn tra cứu này vào xử lý data giao hàng.

Không hiện `customer_id`. Không hiện tuyến cũ.

`NO_RULE`: đơn giá “—”, kết quả “Không có rule”. Không hiện 0.  
`AMBIGUOUS`: đơn giá “—”, kết quả “Nhiều rule cùng khớp”.  
`MATCHED` và amount 0: hiện “0”, kết quả “Khớp”.  
Nguồn chỉ hiện khi khớp: “Đại lý” hoặc “Điểm trả”.

`point_status = NO_POINT`: ba trường điểm hiện “Không khớp điểm”. Bảng phí vẫn hiện. Kể cả khi đã nhập mã mà không còn điểm đúng mã.  
`point_status = MATCHED`: dòng điểm trả hàng là `tên nhà cung cấp - điểm trả`. Không có tên thì mã. Không có cả hai thì chỉ điểm trả. Không lặp địa chỉ đã gõ.  
`AMBIGUOUS` điểm, chưa gửi mã: “Trùng địa chỉ. Nhập mã nhà cung cấp để phân biệt”. Cả ba phí là nhiều rule cùng khớp.  
`AMBIGUOUS` điểm, đã gửi mã: “Hai điểm cùng địa chỉ và cùng mã nhà cung cấp”. Không nhắc nhập mã lần nữa.

Submitting: nút “Đang tra cứu…”, kết quả cũ giữ đến khi có response mới. Lỗi API: toast, kết quả cũ không xóa.

---

### Screen 6: Delta danh sách khách

**Route:** `/accounting-data/customers`  
**File:** `CustomersTable.tsx`

Bỏ cột Bốc xếp.

Nếu user có `route_pricing.view` hoặc `manage`: tên khách là link `a` tới `/route-pricing/surcharges?tenKhachHang={encodeURIComponent(ten_khach_hang)}`. `title` đầy đủ nếu truncate. Không có quyền giá cước thì tên là text, không link.

---

### Screen 7: Delta form khách

**File:** `CreateCustomerModal.tsx`, `EditCustomerModal.tsx`

Bỏ checkbox “Có bốc xếp”. Submit không gửi `boc_xep`. Layout các field còn lại giữ nguyên thứ tự.

---

### Screen 8: Delta upload khách

**File:** `UploadCustomersModal.tsx`

Không đọc cột bốc xếp. Không đưa `boc_xep` vào payload. File Excel cũ còn cột đó thì bỏ qua, không fail. Không thêm text hướng dẫn cột mới.

---

## 3. Component Checklist

| Component | File path | Loại | Dùng ở |
|-----------|-----------|------|--------|
| CustomerSurchargesPage | `frontend/src/pages/route-pricing/CustomerSurchargesPage.tsx` | Mới | Screen 1 |
| SurchargeFormModal | `frontend/src/components/route-pricing/SurchargeFormModal.tsx` | Mới | Screen 2, 3 |
| SurchargeStopDialog | `frontend/src/pages/route-pricing/SurchargeStopDialog.tsx` | Mới | Screen 4 |
| SurchargeDeleteDialog | `frontend/src/pages/route-pricing/SurchargeDeleteDialog.tsx` | Mới | Screen 9 |
| SurchargeLookupModal | `frontend/src/components/route-pricing/SurchargeLookupModal.tsx` | Mới | Screen 5 |
| customerSurchargeApi | `frontend/src/api/customerSurchargeApi.ts` | Mới | API |
| useCustomerSurcharges | `frontend/src/hooks/useCustomerSurcharges.ts` | Mới | Screen 1, 5 |
| MainLayout nav | `frontend/src/layouts/MainLayout.tsx` | Cập nhật | Mục menu |
| Router | `frontend/src/Router.tsx` | Cập nhật | Route mới |
| CustomersTable | `frontend/src/components/admin/CustomersTable.tsx` | Cập nhật | Screen 6 |
| CreateCustomerModal / EditCustomerModal | `frontend/src/components/admin/` | Cập nhật | Screen 7 |
| UploadCustomersModal | `frontend/src/components/admin/UploadCustomersModal.tsx` | Cập nhật | Screen 8 |
| vi.json / en.json | `frontend/src/i18n/` | Cập nhật | Mọi string |

### States bắt buộc

```
- [ ] Loading state  — skeleton bảng, spinner chỉ trên nút đang submit
- [ ] Empty state    — message + CTA Thêm khi manage và chưa lọc
- [ ] Error state    — lỗi + Thử lại
- [ ] Success feedback — toast sau thêm / đổi giá / ngừng / xóa
- [ ] Confirm dialog — ngừng, xóa, và bỏ form dirty
- [ ] Disabled state — nút submit khi request đang chạy
```

---

## 4. Validation UX

| Trường hợp | Hiển thị ở đâu | Khi nào show | Ví dụ message |
|------------|----------------|--------------|----------------|
| Thiếu tên, loại phí, đơn giá, ngày | Inline dưới field | Blur hoặc submit | “Trường này là bắt buộc” |
| Đơn giá không phải số nguyên ≥ 0 | Inline | Blur hoặc submit | “Nhập số nguyên từ 0” |
| Chưa chọn điểm khi phạm vi là điểm | Inline | Submit | “Chọn một điểm trả có địa chỉ” |
| Ngày đổi giá không sau ngày cũ | Inline | Submit | “Chọn ngày sau ngày bắt đầu hiện tại” |
| Ngày ngừng trước ngày bắt đầu | Inline | Submit | “Ngày ngừng không được trước ngày bắt đầu” |
| Tên không có trong danh sách (form thêm) | Inline | Submit | “Chọn khách đang có trong danh sách” |
| Tra cứu thiếu vùng hoặc khung xe | Inline | Submit | “Chọn vùng” / “Chọn khung xe” |
| `POINT_WITHOUT_ADDRESS` | Toast | Sau submit | “Điểm này không có địa chỉ giao hàng” |
| `POINT_NAME_MISMATCH` | Toast | Sau submit | “Điểm trả không thuộc khách đã chọn” |
| `CUSTOMER_NAME_UNKNOWN` | Trong form thêm, theo tên | Sau submit tạo | “Tên không còn trong khách đang hoạt động” |
| `RULE_OPEN_EXISTS` | Trong form thêm, theo tên | Sau submit tạo | “Đã có phụ phí đang mở cùng điều kiện” |
| `RULE_OVERLAP` | Trong form thêm, theo tên | Sau submit tạo | “Ngày bắt đầu chồng với phụ phí đã ngừng” |
| `RULE_AMBIGUOUS` | Trong form thêm, theo tên | Sau submit tạo | “Trùng điều kiện với phụ phí khác, không biết lấy giá nào” |
| `CLOSED_RULE_IMMUTABLE` | Toast | Sau submit | “Rule đã đóng, không đổi được” |
| 500 | Toast | Sau submit | “Lỗi hệ thống, vui lòng thử lại” |
| 401 | Redirect login | Khi nhận 401 | — |

Message toast lấy từ `message` API nếu có, fallback theo code. Không hiện mã code cho user.

---

## 5. i18n Keys cần thêm

```
routePricing.nav.surcharges = "Phụ phí giao hàng"
customerSurcharges.page.title = "Phụ phí giao hàng"
customerSurcharges.page.subtitle = "Giá theo khách. Không nằm trên bảng giá tuyến."
customerSurcharges.action.add = "Thêm phụ phí"
customerSurcharges.action.lookup = "Tra cứu"
customerSurcharges.action.replace = "Đổi giá"
customerSurcharges.action.stop = "Ngừng áp dụng"
customerSurcharges.action.delete = "Xóa phụ phí"
customerSurcharges.action.clearFilters = "Xóa lọc"
customerSurcharges.action.save = "Lưu phụ phí"
customerSurcharges.action.cancel = "Hủy"
customerSurcharges.action.stay = "Ở lại"
customerSurcharges.action.discard = "Bỏ"
customerSurcharges.action.retry = "Thử lại"
customerSurcharges.empty = "Chưa có phụ phí"
customerSurcharges.emptyFiltered = "Không có dòng khớp bộ lọc"
customerSurcharges.error = "Không thể tải dữ liệu"
customerSurcharges.loading = "Đang tải…"
customerSurcharges.saving = "Đang lưu…"
customerSurcharges.stopping = "Đang ngừng…"
customerSurcharges.deleting = "Đang xóa…"
customerSurcharges.lookingUp = "Đang tra cứu…"
customerSurcharges.field.customer = "Tên khách hàng"
customerSurcharges.field.scope = "Phạm vi"
customerSurcharges.field.supplier = "NCC"
customerSurcharges.field.supplierCode = "Mã nhà cung cấp"
customerSurcharges.field.point = "Điểm trả hàng"
customerSurcharges.field.branch = "Chi nhánh"
customerSurcharges.field.feeType = "Loại phí"
customerSurcharges.field.zone = "Vùng"
customerSurcharges.field.vehicleClass = "Khung xe"
customerSurcharges.field.amount = "Đơn giá (đồng)"
customerSurcharges.field.startDate = "Ngày bắt đầu"
customerSurcharges.field.endDate = "Ngày ngừng"
customerSurcharges.field.address = "Địa chỉ giao hàng"
customerSurcharges.field.onDate = "Ngày"
customerSurcharges.scope.dealer = "Toàn hệ thống"
customerSurcharges.scope.point = "Chi nhánh cụ thể"
customerSurcharges.scope.dealerShort = "Đại lý"
customerSurcharges.scope.pointShort = "Điểm trả"
customerSurcharges.fee.boc_xep = "Bốc xếp"
customerSurcharges.fee.phu_phi_giao_hang = "Phụ phí giao hàng"
customerSurcharges.fee.chuyen_tai = "Chuyển tải"
customerSurcharges.zone.any = "Mọi vùng"
customerSurcharges.zone.noi_thanh = "Nội thành"
customerSurcharges.zone.tinh = "Tỉnh"
customerSurcharges.vehicle.any = "Mọi khung xe"
customerSurcharges.vehicle.le_2_5 = "≤2.5 tấn"
customerSurcharges.vehicle.gt_8_16 = ">8-16 tấn"
customerSurcharges.vehicle.gt_16_23 = ">16-23 tấn"
customerSurcharges.vehicle.pallet = "Pallet"
customerSurcharges.unit.tan = "đồng/tấn"
customerSurcharges.unit.chuyen = "đồng/chuyến"
customerSurcharges.status.open = "Đang mở"
customerSurcharges.status.closed = "Đã đóng"
customerSurcharges.status.all = "Tất cả"
customerSurcharges.customerInactive = "Đã ngừng"
customerSurcharges.hint.rateOnly = "Tra cứu trả đơn giá, không nhân với số tấn."
customerSurcharges.hint.replaceDate = "Ngày mới phải sau ngày bắt đầu hiện tại."
customerSurcharges.lookup.noPoint = "Không khớp điểm"
customerSurcharges.lookup.ambiguousPoint = "Trùng điểm, không chọn"
customerSurcharges.lookup.ambiguousNeedCode = "Trùng địa chỉ. Nhập mã nhà cung cấp để phân biệt"
customerSurcharges.lookup.ambiguousSameCode = "Hai điểm cùng địa chỉ và cùng mã nhà cung cấp"
customerSurcharges.placeholder.supplierCode = "VD: 2000000007…"
customerSurcharges.lookup.matched = "Khớp"
customerSurcharges.lookup.noRule = "Không có rule"
customerSurcharges.lookup.ambiguous = "Nhiều rule cùng khớp"
customerSurcharges.lookup.pointLabel = "Điểm trả hàng"
customerSurcharges.lookup.routeLabel = "Tuyến - phường"
customerSurcharges.lookup.feePointLabel = "Điểm giao hàng tính phí"
customerSurcharges.message.success.create = "Đã thêm phụ phí"
customerSurcharges.message.success.replace = "Đã đổi giá"
customerSurcharges.message.success.stop = "Đã ngừng phụ phí"
customerSurcharges.message.success.createMany = "Đã thêm {n} phụ phí"
customerSurcharges.message.success.delete = "Đã xóa phụ phí"
customerSurcharges.message.createFailed = "Không lưu được"
customerSurcharges.confirm.discard = "Bỏ thay đổi?"
customerSurcharges.confirm.stopTitle = "Ngừng phụ phí này?"
customerSurcharges.confirm.deleteOpen = "Xóa phụ phí này?"
customerSurcharges.confirm.deleteOpenBody = "Sau khi xóa, tra cứu sẽ không còn phụ phí này."
customerSurcharges.confirm.deleteOpenHasHistory = "Xóa phụ phí đang áp dụng?"
customerSurcharges.confirm.deleteOpenHasHistoryBody = "Phụ phí cũ không được mở lại. Sau ngày kết thúc của phụ phí cũ, tra cứu không còn phụ phí này."
customerSurcharges.confirm.deletePointFallback = "Nếu điểm không còn phụ phí đang áp dụng cùng loại, tra cứu lấy giá đại lý."
customerSurcharges.confirm.deleteClosed = "Xóa phụ phí đã ngừng?"
customerSurcharges.confirm.deleteClosedBody = "Tra cứu các ngày mà phụ phí này đang khớp sẽ không còn ra số này."
customerSurcharges.reason.openExists = "Đã có phụ phí đang mở cùng điều kiện"
customerSurcharges.reason.overlap = "Ngày bắt đầu chồng với phụ phí đã ngừng"
customerSurcharges.reason.ambiguous = "Trùng điều kiện với phụ phí khác, không biết lấy giá nào"
customerSurcharges.reason.unknownName = "Tên không còn trong khách đang hoạt động"
customerSurcharges.confirm.stopBody = "Sau ngày này rule không còn dùng. Nếu đây là giá riêng cửa hàng, các ngày sau lấy giá đại lý khi đại lý còn rule."
customerSurcharges.validation.required = "Trường này là bắt buộc"
customerSurcharges.validation.amount = "Nhập số nguyên từ 0"
customerSurcharges.validation.point = "Chọn một chi nhánh có địa chỉ"
customerSurcharges.validation.replaceDate = "Chọn ngày sau ngày bắt đầu hiện tại"
customerSurcharges.validation.stopDate = "Ngày ngừng không được trước ngày bắt đầu"
customerSurcharges.validation.customer = "Chọn khách đang có trong danh sách"
customerSurcharges.validation.zone = "Chọn vùng"
customerSurcharges.validation.vehicle = "Chọn khung xe"
```

Tiếng Anh cùng key, câu ngắn. Không hardcode chuỗi trong component.

---

## 6. Không có trên UI

- Không ô import Excel.
- Không checkbox bốc xếp trên khách.
- Không ma trận, không chọn bảng giá, không kỳ phần trăm.
- Không ô phí ghép điểm.
- Không hiện mã `NO_RULE` / `AMBIGUOUS` thô. Dùng câu trong mục 5.
- Không nút chọn tất cả tên.
- Không mục phụ phí đã xóa trên trang này.
