# UI Spec: Theo dõi hóa đơn (Invoice Tracking)

**Ngày:** 2026-08-31
**BA Doc:** docs/ba/20260831_invoice-tracking-analysis.md
**Role liên quan:** dispatch.view, dispatch.manage (tất cả authenticated users xem được, chỉ dispatch.manage mới duyệt)

---

## 1. User Journey

### Happy Path — Tài xế upload chứng từ

```
Sidebar → "Theo dõi hóa đơn"
  → Trang danh sách tickets hiển thị (loading skeleton → data)
  → Tài xế thấy ticket của mình với badge "Tạo mới" (màu xám)
  → Click vào ticket → Modal chi tiết mở ra
  → Click "Upload chứng từ" → Upload modal mở
  → Chọn file ảnh/PDF + nhập ghi chú
  → Click "Gửi" → Spinner → Toast success "Đã upload chứng từ"
  → Modal đóng → Danh sách refresh → Badge chuyển sang "Chờ duyệt" (vàng)
```

### Happy Path — Dispatcher duyệt ticket

```
Sidebar → "Theo dõi hóa đơn"
  → Filter status = "Chờ duyệt"
  → Click vào ticket → Modal chi tiết mở
  → Xem documents (thumbnail preview), đọc driver_note
  → Click "Hoàn thành" → Confirm dialog xuất hiện
  → Click "Xác nhận" → Spinner → Toast success "Đã hoàn thành ticket"
  → Modal đóng → Danh sách refresh → Badge chuyển sang "Hoàn thành" (xanh)
```

### Alternative Path — Dispatcher yêu cầu bổ sung

```
Modal chi tiết ticket (status = "Chờ duyệt")
  → Click "Yêu cầu bổ sung" → Dialog nhập ghi chú xuất hiện
  → Nhập supplement_note (bắt buộc)
  → Click "Gửi yêu cầu" → Spinner → Toast success
  → Modal đóng → Badge chuyển sang "Yêu cầu bổ sung" (đỏ)
```

### Alternative Path — Tài xế bổ sung sau yêu cầu

```
Ticket có badge "Yêu cầu bổ sung" (đỏ)
  → Click vào → Modal chi tiết hiện supplement_note từ dispatcher
  → Click "Bổ sung chứng từ" → Upload modal mở
  → Upload thêm file + cập nhật driver_note
  → Submit → Status chuyển về "Chờ duyệt"
```

### Error Paths

```
- Upload file > 5MB → Toast error "File vượt quá kích thước tối đa 5MB"
- Upload khi status = completed → Toast error "Không thể upload khi ticket đã hoàn thành"
- Finish khi status ≠ pending_review → Toast error "Chỉ có thể duyệt khi ticket ở trạng thái Chờ duyệt"
- Request supplement mà bỏ trống ghi chú → Inline error dưới textarea "Ghi chú bổ sung là bắt buộc"
- Load danh sách fail → Error state với nút "Thử lại"
- API submit fail → Toast error, modal vẫn mở, data không mất
```

---

## 2. Screen Inventory

### Screen 1: Danh sách Theo dõi hóa đơn

**Route:** `/invoice-tracking`
**Role:** Tất cả authenticated users (dispatch.view)
**Điều kiện hiển thị:** Luôn hiển thị khi truy cập route

#### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Theo dõi hóa đơn                                            │
├─────────────────────────────────────────────────────────────┤
│ [Search: biển số/tài xế/mã chuyến]  [Status ▼] [Date range]│
├─────────────────────────────────────────────────────────────┤
│ Table                                                       │
│  STT | Ngày | Biển số | Tài xế | Mã chuyến | Trạng thái    │
│  ...                                                        │
├─────────────────────────────────────────────────────────────┤
│ Pagination: < 1 2 3 ... >    Hiển thị 1-20 / tổng 45      │
└─────────────────────────────────────────────────────────────┘
```

#### Columns

| Column | Data | Notes |
|--------|------|-------|
| STT | Index | Auto-increment per page |
| Ngày | `ngay` | Format DD/MM/YYYY |
| Biển số | `bien_so` | Text |
| Tài xế | `tai_xe` | Text |
| Mã chuyến | `ma_chuyen` | Text |
| Điểm nhận | `diem_nhan` | Truncate nếu dài |
| Điểm trả | `diem_tra` | Truncate nếu dài |
| Trạng thái | `invoice_status` | Badge component |
| Actions | — | Nút "Xem" (eye icon) |

#### Badge Colors

| Status | Color | Label |
|--------|-------|-------|
| `created` | gray | Tạo mới |
| `pending_review` | yellow/warning | Chờ duyệt |
| `completed` | green/success | Hoàn thành |
| `request_supplement` | red/danger | Yêu cầu bổ sung |

#### States

| State | Trigger | UI hiển thị |
|-------|---------|-------------|
| Loading | Đang fetch data | Skeleton loader toàn bộ table (6 rows) |
| Empty | API trả về `[]` | Illustration + text "Chưa có ticket nào" |
| Error | API fail | Text lỗi + nút "Thử lại" |
| Populated | Có data | Table với data đầy đủ |

#### Actions

| Action | Trigger | Kết quả |
|--------|---------|---------|
| Xem chi tiết | Click row hoặc nút eye | Mở TicketDetailModal |
| Filter status | Chọn dropdown | Refetch với filter mới |
| Search | Typing + debounce 300ms | Refetch với search query |
| Date range | Chọn date picker | Refetch với date_from/date_to |
| Pagination | Click page number | Refetch với page mới |

---

### Screen 2: Ticket Detail Modal

**Loại:** Modal (size: xl)
**Mở khi:** Click vào ticket trong danh sách

#### Layout

```
┌─────────────────────────────────────────────────────────┐
│ Chi tiết ticket                                    [X]  │
├─────────────────────────────────────────────────────────┤
│ ┌─ Thông tin chuyến xe ───────────────────────────────┐│
│ │ Ngày: 31/08/2026  |  Biển số: 51C-12345            ││
│ │ Tài xế: Nguyễn Văn A  |  Mã chuyến: MC001          ││
│ │ Điểm nhận: Kho A  →  Điểm trả: Khách hàng B        ││
│ │ Giờ nhận: 08:00  |  Loại tuyến: Tuyến cố định      ││
│ │ Ghi chú: ...                                        ││
│ └─────────────────────────────────────────────────────┘│
│                                                         │
│ ┌─ Trạng thái & Lịch sử ──────────────────────────────┐│
│ │ [Badge: Chờ duyệt]                                  ││
│ │ Driver note: "Đã chụp đầy đủ hóa đơn"               ││
│ │ Supplement note: (nếu có, hiển thị trong box đỏ)    ││
│ │ Reviewed at: 31/08/2026 14:30 by Trần Văn B         ││
│ └─────────────────────────────────────────────────────┘│
│                                                         │
│ ┌─ Chứng từ (3 files) ────────────────────────────────┐│
│ │ [📷 Thumb1] [📷 Thumb2] [📄 PDF1]                   ││
│ │ Click để xem full-size                              ││
│ └─────────────────────────────────────────────────────┘│
│                                                         │
│ ┌─ Actions ───────────────────────────────────────────┐│
│ │ [Upload chứng từ]  [Hoàn thành]  [Yêu cầu bổ sung] ││
│ └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

#### Conditional Actions Visibility

| Action | Visible when | Permission |
|--------|-------------|------------|
| Upload chứng từ | status ∈ {created, request_supplement} | Any authenticated (future: driver_id match) |
| Hoàn thành | status = pending_review | dispatch.manage |
| Yêu cầu bổ sung | status = pending_review | dispatch.manage |

#### States

| State | Trigger | UI hiển thị |
|-------|---------|-------------|
| Loading | Đang fetch detail | Spinner center modal |
| Loaded | Fetch success | Full content |
| Error | Fetch fail | Error message + nút "Thử lại" |

---

### Screen 3: Upload Documents Modal

**Loại:** Modal (size: md)
**Mở khi:** Click "Upload chứng từ" trong TicketDetailModal

#### Layout

```
┌─────────────────────────────────────┐
│ Upload chứng từ                 [X] │
├─────────────────────────────────────┤
│                                     │
│ ┌─ Drag & Drop Zone ──────────────┐│
│ │  Kéo thả file hoặc click chọn   ││
│ │  Hỗ trợ: JPG, PNG, PDF          ││
│ │  Tối đa: 10 files, 5MB/file     ││
│ └─────────────────────────────────┘│
│                                     │
│ Selected files:                     │
│ ☑ hoa_don_1.jpg (2.3 MB)       [x] │
│ ☑ bien_ban.pdf (1.1 MB)        [x] │
│                                     │
│ Ghi chú:                            │
│ ┌─────────────────────────────────┐│
│ │                                 ││
│ └─────────────────────────────────┘│
│                                     │
│              [Hủy]  [Gửi chứng từ] │
└─────────────────────────────────────┘
```

#### States

| State | Trigger | UI hiển thị |
|-------|---------|-------------|
| Default | Mở modal | Drop zone trống, button enabled |
| Files selected | Chọn files | List files hiện, remove buttons |
| Uploading | Click gửi | Button disabled + spinner, drop zone locked |
| Upload error | API fail | Toast error, modal mở, files giữ nguyên |
| Upload success | API success | Toast success, modal đóng, detail refresh |
| Validation error | File > 5MB hoặc sai type | Inline error dưới drop zone |

---

### Screen 4: Review Dialog (Supplement Note)

**Loại:** Dialog (size: sm)
**Mở khi:** Click "Yêu cầu bổ sung" trong TicketDetailModal

#### Layout

```
┌─────────────────────────────────────┐
│ Yêu cầu bổ sung chứng từ            │
├─────────────────────────────────────┤
│                                     │
│ Ghi chú bổ sung (bắt buộc):         │
│ ┌─────────────────────────────────┐│
│ │ Thiếu hóa đơn giao hàng ngày... ││
│ │                                 ││
│ └─────────────────────────────────┘│
│ ⚠️ Ghi chú bổ sung là bắt buộc      │
│                                     │
│              [Hủy]  [Gửi yêu cầu]  │
└─────────────────────────────────────┘
```

#### States

| State | Trigger | UI hiển thị |
|-------|---------|-------------|
| Default | Mở dialog | Textarea rỗng, button enabled |
| Empty submit | Click gửi mà trống | Inline error dưới textarea |
| Submitting | Click gửi hợp lệ | Button disabled + spinner |
| Success | API success | Toast success, dialog đóng, detail refresh |
| Error | API fail | Toast error, dialog mở, text giữ nguyên |

---

### Screen 5: Confirm Finish Dialog

**Loại:** Confirm Dialog (size: sm)
**Mở khi:** Click "Hoàn thành" trong TicketDetailModal

#### Layout

```
┌─────────────────────────────────────┐
│ Xác nhận hoàn thành                 │
├─────────────────────────────────────┤
│                                     │
│ Bạn có chắc muốn đánh dấu ticket    │
│ này là "Hoàn thành"?                │
│                                     │
│ Hành động này không thể hoàn tác.   │
│                                     │
│              [Hủy]  [Xác nhận]     │
└─────────────────────────────────────┘
```

---

## 3. Component Checklist

### Danh sách components cần tạo

| Component | File path | Loại | Dùng ở |
|-----------|-----------|------|--------|
| InvoiceTrackingPage | `frontend/src/pages/invoice-tracking/InvoiceTrackingPage.tsx` | Mới | Screen 1 |
| TicketDetailModal | `frontend/src/components/invoice-tracking/TicketDetailModal.tsx` | Mới | Screen 2 |
| UploadDocumentsModal | `frontend/src/components/invoice-tracking/UploadDocumentsModal.tsx` | Mới | Screen 3 |
| SupplementNoteDialog | `frontend/src/components/invoice-tracking/SupplementNoteDialog.tsx` | Mới | Screen 4 |
| ConfirmFinishDialog | `frontend/src/components/invoice-tracking/ConfirmFinishDialog.tsx` | Mới | Screen 5 |
| InvoiceStatusBadge | `frontend/src/components/invoice-tracking/InvoiceStatusBadge.tsx` | Mới | Screen 1, 2 |
| DocumentPreview | `frontend/src/components/invoice-tracking/DocumentPreview.tsx` | Mới | Screen 2 |

### Components tái sử dụng (đã có)

| Component | Dùng ở |
|-----------|--------|
| Table, TableHeader, TableBody, TableRow, TableHead, TableCell | Screen 1 |
| Modal | Screen 2, 3 |
| Button | Tất cả screens |
| Input (textarea variant) | Screen 3, 4 |
| Badge | Screen 1, 2 (wrap bởi InvoiceStatusBadge) |
| Select | Screen 1 (filter) |

### States bắt buộc

```
- [x] Loading state — skeleton cho list, spinner cho modals
- [x] Empty state — illustration + message cho list rỗng
- [x] Error state — message + nút "Thử lại" cho list và detail
- [x] Success feedback — toast sau upload, finish, request_supplement
- [x] Confirm dialog — trước finish action
- [x] Disabled state — buttons khi submitting
```

---

## 4. Validation UX

| Trường hợp | Hiển thị ở đâu | Khi nào show | Ví dụ message |
|------------|---------------|--------------|---------------|
| File > 5MB | Inline dưới drop zone | Khi chọn file | "File 'xxx.jpg' vượt quá 5MB" |
| Sai MIME type | Inline dưới drop zone | Khi chọn file | "Chỉ chấp nhận JPG, PNG, PDF" |
| Quá 10 files | Inline dưới drop zone | Khi chọn file | "Tối đa 10 files mỗi lần upload" |
| Supplement note trống | Inline dưới textarea | Khi click gửi | "Ghi chú bổ sung là bắt buộc" |
| Upload fail (wrong status) | Toast error | Sau khi submit | "Không thể upload khi ticket đã hoàn thành" |
| Review fail (wrong status) | Toast error | Sau khi submit | "Chỉ có thể duyệt khi ticket ở trạng thái Chờ duyệt" |
| Server error (500) | Toast error | Sau khi submit | "Lỗi hệ thống, vui lòng thử lại" |
| Session hết hạn (401) | Redirect login | Khi nhận 401 | — |
| Load list fail | Error state trong page | Khi fetch fail | "Không thể tải danh sách ticket" + nút "Thử lại" |
| Load detail fail | Error state trong modal | Khi fetch fail | "Không thể tải chi tiết ticket" + nút "Thử lại" |

---

## 5. i18n Keys cần thêm

```
invoice_tracking.page.title = "Theo dõi hóa đơn"
invoice_tracking.page.empty = "Chưa có ticket nào"
invoice_tracking.page.error = "Không thể tải danh sách ticket"
invoice_tracking.page.retry = "Thử lại"

invoice_tracking.filter.search.placeholder = "Tìm theo biển số, tài xế, mã chuyến..."
invoice_tracking.filter.status.all = "Tất cả trạng thái"
invoice_tracking.filter.status.created = "Tạo mới"
invoice_tracking.filter.status.pending_review = "Chờ duyệt"
invoice_tracking.filter.status.completed = "Hoàn thành"
invoice_tracking.filter.status.request_supplement = "Yêu cầu bổ sung"

invoice_tracking.table.stt = "STT"
invoice_tracking.table.date = "Ngày"
invoice_tracking.table.bien_so = "Biển số"
invoice_tracking.table.tai_xe = "Tài xế"
invoice_tracking.table.ma_chuyen = "Mã chuyến"
invoice_tracking.table.diem_nhan = "Điểm nhận"
invoice_tracking.table.diem_tra = "Điểm trả"
invoice_tracking.table.status = "Trạng thái"
invoice_tracking.table.actions = "Thao tác"

invoice_tracking.detail.title = "Chi tiết ticket"
invoice_tracking.detail.trip_info = "Thông tin chuyến xe"
invoice_tracking.detail.status_history = "Trạng thái & Lịch sử"
invoice_tracking.detail.documents = "Chứng từ"
invoice_tracking.detail.driver_note = "Ghi chú tài xế"
invoice_tracking.detail.supplement_note = "Yêu cầu bổ sung"
invoice_tracking.detail.reviewed_at = "Duyệt lúc"
invoice_tracking.detail.no_documents = "Chưa có chứng từ"

invoice_tracking.action.upload = "Upload chứng từ"
invoice_tracking.action.finish = "Hoàn thành"
invoice_tracking.action.request_supplement = "Yêu cầu bổ sung"
invoice_tracking.action.view = "Xem"
invoice_tracking.action.cancel = "Hủy"
invoice_tracking.action.submit = "Gửi"
invoice_tracking.action.confirm = "Xác nhận"
invoice_tracking.action.retry = "Thử lại"

invoice_tracking.upload.title = "Upload chứng từ"
invoice_tracking.upload.dropzone = "Kéo thả file hoặc click chọn"
invoice_tracking.upload.supported = "Hỗ trợ: JPG, PNG, PDF"
invoice_tracking.upload.max = "Tối đa: 10 files, 5MB/file"
invoice_tracking.upload.note_label = "Ghi chú"
invoice_tracking.upload.note_placeholder = "Nhập ghi chú (tùy chọn)..."
invoice_tracking.upload.submit = "Gửi chứng từ"
invoice_tracking.upload.error.size = "File '{name}' vượt quá 5MB"
invoice_tracking.upload.error.type = "Chỉ chấp nhận JPG, PNG, PDF"
invoice_tracking.upload.error.count = "Tối đa 10 files mỗi lần upload"

invoice_tracking.supplement.title = "Yêu cầu bổ sung chứng từ"
invoice_tracking.supplement.note_label = "Ghi chú bổ sung (bắt buộc)"
invoice_tracking.supplement.note_placeholder = "Nhập lý do yêu cầu bổ sung..."
invoice_tracking.supplement.note_required = "Ghi chú bổ sung là bắt buộc"
invoice_tracking.supplement.submit = "Gửi yêu cầu"

invoice_tracking.confirm_finish.title = "Xác nhận hoàn thành"
invoice_tracking.confirm_finish.message = "Bạn có chắc muốn đánh dấu ticket này là \"Hoàn thành\"?"
invoice_tracking.confirm_finish.warning = "Hành động này không thể hoàn tác."

invoice_tracking.message.success.upload = "Đã upload chứng từ thành công"
invoice_tracking.message.success.finish = "Đã hoàn thành ticket"
invoice_tracking.message.success.supplement = "Đã gửi yêu cầu bổ sung"
invoice_tracking.message.error.upload = "Upload thất bại, vui lòng thử lại"
invoice_tracking.message.error.review = "Không thể duyệt ticket này"
invoice_tracking.message.error.wrong_status = "Ticket không ở trạng thái phù hợp"
invoice_tracking.message.error.server = "Lỗi hệ thống, vui lòng thử lại"
```

</content>