# UI Spec: Lên bảng kê thô 5 nhà
**Ngày:** 2026-09-13
**BA Doc:** `docs/ba/20260913_bang-ke-tho-5-nha-analysis.md`
**Role:** user có `accounting_data.view` (xem/tải) và/hoặc `accounting_data.manage` (upload/xóa). ADMIN: đủ quyền.

**Guidelines (Vercel Web Interface Guidelines):** dropzone + file input có label; nút icon `aria-label`; confirm trước xóa/ghi đè; toast `aria-live="polite"`; loading kết thúc bằng `…`; truncate tên file dài (`min-w-0`); phân trang/tìm trên URL; `prefers-reduced-motion` cho spinner; không `outline-none` nếu không có `focus-visible`; dark mode theo theme app.

---

## 1. User Journey

### Happy Path
```
Sidebar → Dữ liệu kế toán → “Lên bảng kê thô 5 nhà”
  → Trang: skeleton bảng → danh sách (hoặc empty)
  → User manage: kéo thả / chọn 1-8.7.xlsx
  → Nút “Lưu file” (hoặc auto-upload ngay khi chọn — chọn: chọn file rồi bấm Lưu)
  → Spinner “Đang lưu…”
  → Toast thành công → bảng refresh, dòng mới trên cùng
  → User khác: tìm “1-8.7” → bấm Tải file gốc → browser download 1-8.7.xlsx
  → Cột ND-MCC / CLV / Calofic: badge “Chưa xử lý”, không tải được
```

### Alternative Paths
```
- Gõ ô tìm → debounce 300ms → ?q= trên URL, page=1
- Đổi trang → ?page=
- Manage: Xóa → modal confirm → toast → dòng biến mất
- 409 trùng tên → modal ghi đè → Hủy: không đổi; Ghi đè: lưu file mới
- User chỉ view: không dropzone, không nút xóa
```

### Error Paths
```
- Chọn .xls / >10 MB: toast, không gọi API
- 400 thiếu Processed: toast message server, form/dropzone vẫn dùng được
- List 500: error state + “Thử lại”
- 401: redirect login
- 403 action: toast “Bạn không có quyền thực hiện thao tác này”
- Download 404: toast “Không tìm thấy file”
```

---

## 2. Screen Inventory

### Screen 1: Lên bảng kê thô 5 nhà
**Route:** `/accounting-data/bang-ke-tho`  
**Layout:** `MainLayout`  
**Menu:** `accountingDataSubItems` — sau “Import 5 nhà”, icon `FileSpreadsheet`  
**Hiện menu khi:** `showAccountingData` (đã có)

**Query URL (bắt buộc sync):** `page` (default 1), `q` (default rỗng)

#### Layout
```
┌─────────────────────────────────────────────────────────────────┐
│ Lên bảng kê thô 5 nhà                                            │  h1, text-pretty
│ Lưu file đã xử lý 5 nhà để đồng nghiệp tải đúng đợt.             │  muted, 1 dòng
│ Module từng nhà sẽ bổ sung sau — hiện tại chỉ lưu file gốc.      │
├─────────────────────────────────────────────────────────────────┤
│ [Chỉ accounting_data.manage]                                     │
│ ┌─ Dropzone ─────────────────────────────────────────────────┐  │
│ │  Kéo thả file .xlsx vào đây, hoặc bấm để chọn               │  │
│ │  Tối đa 10 MB. Cần sheet “Processed”.                       │  │
│ └────────────────────────────────────────────────────────────┘  │
│ File đã chọn: 1-8.7.xlsx (1,3 MB)    [Hủy chọn] [Lưu file]     │
├─────────────────────────────────────────────────────────────────┤
│ [Tìm theo tên file…          ]                                   │  search, type=search
├─────────────────────────────────────────────────────────────────┤
│ Tên file          │ Người upload │ Thời điểm     │ ND-MCC │ CLV │ Calofic │ Thao tác │
│ 1-8.7.xlsx        │ Nguyễn A     │ 13/09/2026 …  │ badge  │ …   │ …       │ tải, xóa │
│ 9-16.7.xlsx       │ …            │ …             │ …      │ …   │ …       │ …        │
├─────────────────────────────────────────────────────────────────┤
│ Hiển thị 1–20 / 36                    [‹] 1 2 [›]                │
└─────────────────────────────────────────────────────────────────┘
```

Cột số / ngày: `tabular-nums`. Tên file: `truncate` + `title` full name. `translate="no"` trên tên file.

#### States — trang

| State | Trigger | UI |
|-------|---------|-----|
| Loading | Fetch list lần đầu / đổi page/q | Skeleton 5 hàng bảng; dropzone vẫn hiện (manage) |
| Empty (chưa có đợt, `q` rỗng) | `total=0` | Bảng ẩn; illustration/text: “Chưa có file bảng kê thô.” Manage: “Upload file đã xử lý 5 nhà để bắt đầu.” View: không CTA upload |
| Empty search | `q` có, `data=[]` | Bảng trống: “Không tìm thấy đợt nào khớp ‘{q}’.” |
| Error | GET fail | Text lỗi + nút “Thử lại” |
| Populated | Có rows | Bảng + pagination nếu `totalPages > 1` |
| Uploading | POST đang chạy | Dropzone + “Lưu file” disabled, spinner trên nút, text “Đang lưu…” |
| Downloading | GET blob input | Nút tải dòng đó spinner; các nút khác vẫn dùng được |

#### States — dropzone (manage)

| State | UI |
|-------|-----|
| Idle | Border dashed, keyboard: Enter/Space mở file picker (`input type=file` ẩn, `accept=.xlsx`, gắn `id` + label) |
| Drag over | Border/background nhấn mạnh hơn (không `transition: all` — chỉ `border-color`, `background-color`) |
| File selected | Tên + size (`Intl.NumberFormat` MB, 1 decimal) + Hủy chọn + Lưu file |
| Disabled | Khi uploading |

View: **không render** dropzone.

#### House badge (3 cột)

| `status` | Badge | Tải output |
|----------|-------|------------|
| `pending` | Neutral/outline: “Chưa xử lý” | Không nút (sprint này luôn vậy) |
| `ready` | Success: “Sẵn sàng” + icon download (`aria-label` = `Tải {download_filename}`) | Sprint sau |
| `failed` | Danger: “Lỗi” + `title`/`Tooltip` = `error_message` | Không tải |

Dev **phải** implement 3 trạng thái badge (data đã có field); `ready`/`failed` không xuất hiện cho đến module sau.

#### Actions

| Action | Ai | Trigger | Kết quả |
|--------|-----|---------|---------|
| Chọn file | Manage | Drop / click zone / Enter | Validate client; sai → toast, clear input |
| Hủy chọn | Manage | Click | Clear file, idle |
| Lưu file | Manage | Click “Lưu file” (disabled khi chưa chọn) | POST; 200 toast + reset dropzone + invalidate list; 409 → modal ghi đè (giữ file đã chọn) |
| Tìm | View+ | Gõ | `q` URL, reset page=1 |
| Tải gốc | View+ | Icon Download | GET blob → saveAs tên gốc; `aria-label`: “Tải file gốc {filename}” |
| Xóa | Manage | Icon Trash | Mở modal xóa; `aria-label`: “Xóa đợt {filename}” |
| Phân trang | View+ | Pagination | `page` URL |

**Không có:** date picker kỳ, nút “Chạy module”, upload output nhà, preview Excel.

---

### Screen 2: Modal ghi đè
**Loại:** Modal (`overscroll-behavior: contain`)  
**Mở khi:** POST 409 `BANG_KE_DUPLICATE`

#### Layout
```
┌────────────────────────────────────────────┐
│ File đã tồn tại                         [X]│
├────────────────────────────────────────────┤
│ Đã có đợt “{original_filename}”.           │
│ Ghi đè sẽ xóa file gốc hiện tại và mọi     │
│ bảng kê nhà (kể cả đã xử lý).              │
│                                            │
│ [Hủy]                    [Ghi đè file]     │
└────────────────────────────────────────────┘
```

Nút ghi đè: `variant=danger` (destructive). Focus trap; Esc / Hủy / X = đóng, **không** POST. Submit: POST `overwrite=true`, submitting lock + spinner “Đang ghi đè…”. Success: đóng + toast “Đã ghi đè file” + refresh. Fail: toast, modal mở, file chọn vẫn còn.

---

### Screen 3: Modal xóa đợt
**Loại:** Modal  
**Mở khi:** bấm xóa

```
┌────────────────────────────────────────────┐
│ Xóa đợt                                 [X]│
├────────────────────────────────────────────┤
│ Xóa “{original_filename}”? File gốc và     │
│ bảng kê nhà sẽ không khôi phục được.       │
│                                            │
│ [Hủy]                         [Xóa đợt]    │
└────────────────────────────────────────────┘
```

`Xóa đợt` danger. Submitting lock. Success: đóng, toast “Đã xóa đợt”, nếu trang hiện empty (xóa hết trang) → lui `page`. Fail: toast, modal mở.

---

## 3. Component Checklist

| Component | Path | Loại | Dùng ở |
|-----------|------|------|--------|
| `BangKeThoPage` | `frontend/src/pages/admin/accounting-data/BangKeThoPage.tsx` | Mới | Screen 1 |
| `BangKeThoDropzone` | `frontend/src/components/bang-ke-tho/BangKeThoDropzone.tsx` | Mới | Screen 1 |
| `BangKeThoTable` | `frontend/src/components/bang-ke-tho/BangKeThoTable.tsx` | Mới | Screen 1 |
| `BangKeThoHouseBadge` | `frontend/src/components/bang-ke-tho/BangKeThoHouseBadge.tsx` | Mới | Table |
| `BangKeThoOverwriteDialog` | `frontend/src/components/bang-ke-tho/BangKeThoOverwriteDialog.tsx` | Mới | Screen 2 |
| `BangKeThoDeleteDialog` | `frontend/src/components/bang-ke-tho/BangKeThoDeleteDialog.tsx` | Mới | Screen 3 |
| `bangKeThoApi.ts` | `frontend/src/api/bangKeThoApi.ts` | Mới | |
| `useBangKeTho.ts` | `frontend/src/hooks/useBangKeTho.ts` | Mới | React Query |
| `Router.tsx` | route mới | Cập nhật | |
| `MainLayout.tsx` | sub-item | Cập nhật | |
| `Modal`, `Table`, `Button`, `Input`, `Badge`, `Pagination`, `Card` | `components/ui/` | Tái sử dụng | |

Pattern dropzone: `DeliveryImportPage` / `DriverInvoiceUploadModal` — không invent layout mới.

### States bắt buộc
```
- [ ] Loading — skeleton bảng
- [ ] Empty — chưa có đợt vs không khớp tìm
- [ ] Error — Thử lại
- [ ] Success toast — lưu / ghi đè / xóa
- [ ] Confirm — ghi đè và xóa
- [ ] Disabled — Lưu file khi uploading hoặc chưa chọn file
```

---

## 4. Validation UX

| Trường hợp | Ở đâu | Khi nào | Message (i18n) |
|------------|-------|---------|----------------|
| Không phải `.xlsx` | Toast | Chọn/drop | “Chỉ chấp nhận file .xlsx” |
| > 10 MB | Toast | Chọn/drop | “File quá lớn (tối đa 10 MB)” |
| Chưa chọn file, bấm Lưu | Nút disabled | — | — |
| Thiếu sheet Processed | Toast | Sau POST 400 | Dùng `message` server |
| Trùng tên | Modal | 409 | Screen 2 |
| Lỗi mạng / 500 | Toast | Sau POST/DELETE/GET | “Không lưu được file. Thử lại.” / “Không tải được danh sách.” |
| 403 | Toast | Action cấm | “Bạn không có quyền thực hiện thao tác này” |
| 401 | Redirect | — | — |

Không inline field Excel (không form text). File input: `aria-label` / label “Chọn file Excel”.

---

## 5. i18n Keys

Thêm `frontend/src/i18n/vi.json` (và `en.json` nếu project bắt đủ cặp):

```
bangKeTho.title = "Lên bảng kê thô 5 nhà"
bangKeTho.subtitle = "Lưu file đã xử lý 5 nhà để đồng nghiệp tải đúng đợt."
bangKeTho.subtitleHint = "Module từng nhà sẽ bổ sung sau — hiện tại chỉ lưu file gốc."
bangKeTho.nav = "Bảng kê thô 5 nhà"
bangKeTho.dropzone = "Kéo thả file .xlsx vào đây, hoặc bấm để chọn"
bangKeTho.dropzoneHint = "Tối đa 10 MB. Cần sheet “Processed”."
bangKeTho.chooseFile = "Chọn file Excel"
bangKeTho.selectedFile = "File đã chọn"
bangKeTho.clearFile = "Hủy chọn"
bangKeTho.saveFile = "Lưu file"
bangKeTho.saving = "Đang lưu…"
bangKeTho.overwriting = "Đang ghi đè…"
bangKeTho.searchPlaceholder = "Tìm theo tên file…"
bangKeTho.col.filename = "Tên file"
bangKeTho.col.uploadedBy = "Người upload"
bangKeTho.col.uploadedAt = "Thời điểm"
bangKeTho.col.ndMcc = "ND-MCC"
bangKeTho.col.clv = "CLV"
bangKeTho.col.calofic = "Calofic"
bangKeTho.col.actions = "Thao tác"
bangKeTho.house.pending = "Chưa xử lý"
bangKeTho.house.ready = "Sẵn sàng"
bangKeTho.house.failed = "Lỗi"
bangKeTho.action.downloadInput = "Tải file gốc"
bangKeTho.action.downloadOutput = "Tải {filename}"
bangKeTho.action.delete = "Xóa đợt"
bangKeTho.empty = "Chưa có file bảng kê thô."
bangKeTho.emptyHintManage = "Upload file đã xử lý 5 nhà để bắt đầu."
bangKeTho.emptySearch = "Không tìm thấy đợt nào khớp “{q}”."
bangKeTho.error = "Không tải được danh sách."
bangKeTho.retry = "Thử lại"
bangKeTho.message.success.save = "Đã lưu file bảng kê thô"
bangKeTho.message.success.overwrite = "Đã ghi đè file"
bangKeTho.message.success.delete = "Đã xóa đợt"
bangKeTho.message.error.save = "Không lưu được file. Thử lại."
bangKeTho.message.error.download = "Không tìm thấy file"
bangKeTho.message.error.forbidden = "Bạn không có quyền thực hiện thao tác này"
bangKeTho.message.error.type = "Chỉ chấp nhận file .xlsx"
bangKeTho.message.error.size = "File quá lớn (tối đa 10 MB)"
bangKeTho.overwrite.title = "File đã tồn tại"
bangKeTho.overwrite.body = "Đã có đợt “{filename}”. Ghi đè sẽ xóa file gốc hiện tại và mọi bảng kê nhà (kể cả đã xử lý)."
bangKeTho.overwrite.confirm = "Ghi đè file"
bangKeTho.overwrite.cancel = "Hủy"
bangKeTho.delete.title = "Xóa đợt"
bangKeTho.delete.body = "Xóa “{filename}”? File gốc và bảng kê nhà sẽ không khôi phục được."
bangKeTho.delete.confirm = "Xóa đợt"
bangKeTho.delete.cancel = "Hủy"
```

Thời điểm: `formatDateTime` hiện có (`Intl`), không hardcode.

---

## 6. Web Design Guidelines — áp dụng spec

| Rule | Áp dụng |
|------|---------|
| Icon-only buttons | `aria-label` tải/xóa |
| File input labelled | Label / `aria-label` dropzone |
| Keyboard | Dropzone focusable, Enter/Space mở picker; modal Esc |
| Loading copy | “Đang lưu…”, “Đang ghi đè…” |
| Truncate | Tên file dài + `title` |
| URL state | `page`, `q` |
| Destructive confirm | Hai modal, không xóa/ghi đè một click |
| Toast live | `aria-live="polite"` (component toast hiện có) |
| Reduced motion | Spinner tôn trọng `prefers-reduced-motion` nếu app đã có; không `transition: all` |
| Focus visible | Nút/ui hiện có; không bỏ ring |
| Empty | Hai empty khác nhau (chưa data / search) |
| Pagination | `tabular-nums` |

**Không** preview Excel trên UI (tránh list lớn không virtualize).
