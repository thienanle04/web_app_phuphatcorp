# UI Spec: Module Xử lý Bảng Kê Thô ND-MCC (MCC & NDFC)
**Ngày:** 2026-09-19  
**BA Doc:** `docs/ba/20260919_bang-ke-tho-nd-mcc-analysis.md`  
**Role:** `accounting_data.view` (xem trạng thái, tải file output), `accounting_data.manage` (kích hoạt xử lý / chạy lại). ADMIN: toàn quyền.  
**Guidelines:** Vercel Web Interface Guidelines (touch target ≥ 44px, tooltip rõ ràng, spinner kết thúc bằng "…", không layout shift, accessible aria-labels, dark/light theme).

---

## 1. User Journey

### Happy Path (Kế toán kích hoạt xử lý ND-MCC)
```
Sidebar → Dữ liệu kế toán → "Lên bảng kê thô 5 nhà" (/accounting-data/bang-ke-tho)
  → Bảng hiển thị danh sách các đợt đã upload
  → Tại cột "ND-MCC" của đợt cần xử lý (ví dụ: đợt "1-8.7.xlsx"):
      - Cột đang ở trạng thái Pending: Hiển thị nút "Xử lý" (icon Play + chữ "Xử lý")
  → User (có quyền manage) bấm nút "Xử lý"
  → Nút chuyển sang trạng thái loading: Spinner 20px xoay + chữ "Đang xử lý…" (các nút của đợt đó tạm disable)
  → Backend hoàn tất sinh 8 sheets, lưu MinIO, trả về HTTP 200
  → Toast thông báo: "Xử lý bảng kê ND-MCC đợt 1-8.7.xlsx thành công"
  → Dòng đợt tự động refresh:
      - Cột "ND-MCC" chuyển sang hiển thị 2 icon buttons (20px, không dùng text badge):
        + Nút "Tải file" (icon Download 20px trong nút vuông 34x34px)
        + Nút "Chạy lại" (icon RefreshCw 20px trong nút vuông 34x34px)
  → User bấm "Tải file":
      - Trình duyệt tải xuống file "ND-MCC 1-8.7.xlsx"
```

### Alternative Paths (Chạy lại / Re-process)
```
- User muốn cập nhật lại bảng giá hoặc làm mới dữ liệu sau khi sửa master data:
  → Bấm nút "Chạy lại" (RefreshCw) tại cột ND-MCC
  → Hệ thống hiển thị spinner "Đang xử lý…"
  → Backend ghi đè file trên MinIO và cập nhật thời điểm generated_at mới
  → Toast thành công, giao diện giữ nguyên 2 nút Tải xuống + Chạy lại
```

### Error Paths
```
- Quá trình xử lý bị lỗi (thiếu sheet Processed, file hỏng, lỗi hệ thống):
  → Backend trả về lỗi (400/500)
  → Toast lỗi: "Xử lý ND-MCC thất bại: {lý do}"
  → Cột "ND-MCC" chuyển sang hiển thị:
      - Nút "Chạy lại" (RefreshCw)
      - Icon cảnh báo màu đỏ (AlertCircle 20px) nằm ngay bên phải nút Chạy lại
  → Hover vào icon cảnh báo đỏ hiển thị tooltip: {error_message}
  → Nút "Chạy lại" cho phép user bấm để thử lại sau khi xử lý master data
- User chỉ có quyền view (không có manage):
  → Khi chưa xử lý hoặc bị lỗi: Hiển thị icon Tải file disabled (mờ opacity-40)
  → Khi đã sẵn sàng: Chỉ hiển thị nút "Tải file" (Download)
```

---

## 2. Screen Inventory & Component Specs

### 2.1 Màn hình ảnh hưởng: `/accounting-data/bang-ke-tho`
Nằm trong bảng danh sách đợt (`BangKeThoTable`), tập trung tối ưu diện tích và độ rõ ràng của cột **ND-MCC**.

#### Mockup giao diện ô cột ND-MCC:

```
Trạng thái 1: Pending (Chưa xử lý)
- canManage: [▶ Xử lý]
- viewer:    [⬇] (disabled, mờ opacity-40, tooltip "Chưa xử lý")

Trạng thái 2: Processing (Đang xử lý)
┌─────────────────────────────────┐
│ [⟳] Đang xử lý…                 │
└─────────────────────────────────┘

Trạng thái 3: Ready (Sẵn sàng - Không dùng text badge)
┌─────────────────────────────────┐
│ [⬇]  [↻]                        │ (Icon h-4 w-4, button variant="ghost" size="sm")
└─────────────────────────────────┘

Trạng thái 4: Failed (Lỗi - Không dùng text badge)
┌─────────────────────────────────┐
│ [↻]  ⚠                          │ (Nút Chạy lại + Icon cảnh báo đỏ h-4 w-4 bên phải)
└─────────────────────────────────┘
```

### 2.2 Quy định Component: `BangKeThoHouseCell`
Component phụ trách render từng ô nhà (`nd_mcc`, `clv`, `calofic`). Đối với nhà `nd_mcc`:

1. **Bỏ toàn bộ text badge trạng thái:**
   - Không dùng các badge text cồng kềnh ("Sẵn sàng", "Lỗi", "Chưa xử lý") để giữ bảng dữ liệu gọn gàng, đồng bộ kích thước các cột.
   - Các nhà chưa kích hoạt tính năng tự động (CLV, Calofic) vẫn giữ badge mặc định.

2. **Kích thước và Style nút Action:**
   - Đồng bộ hoàn toàn với các nút Thao tác ở cột bên phải (`variant="ghost" size="sm"`).
   - **Kích thước icon:** `h-4 w-4` (16px) gọn gàng, đồng nhất toàn bảng.
   - **Nút "Tải file":** Icon `Download`, `variant="ghost" size="sm"`, `title` & `aria-label="Tải bảng kê ND-MCC"`. Khi đang tải file hiển thị spinner xoay.
   - **Nút "Chạy lại":** Icon `RefreshCw`, `variant="ghost" size="sm"`, `title` & `aria-label="Chạy lại bảng kê ND-MCC"`.
   - **Icon Cảnh báo lỗi:** Icon `AlertCircle` màu đỏ (`text-red-500 hover:text-red-600 h-4 w-4`) đặt trong khung `p-1.5` ngay bên phải nút Chạy lại, có `title` & tooltip hiển thị chi tiết `house.error_message`.
   - **Nút "Xử lý" (khi Pending):** Button kích thước nhỏ `h-[34px] px-3`, viền xanh lục (`border-emerald-300 dark:border-emerald-800`), icon `Play` + text "Xử lý".

---

## 3. State & Validation Checklist

| Trạng thái | Quyền | Phản hồi giao diện | Ghi chú |
|---|---|---|---|
| `pending` | `canManage` | Nút `[▶ Xử lý]` | Click để bắt đầu sinh 8 sheets ND-MCC |
| `pending` | Viewer | Nút `[⬇]` mờ disabled | Opacity 40%, tooltip "Chưa xử lý" |
| `processing` | Tất cả | Spinner `[⟳]` + "Đang xử lý…" | Disable các nút action liên quan |
| `ready` | `canManage` | Nút `[⬇]` + Nút `[↻]` | Icon 20px, nút vuông 34x34px |
| `ready` | Viewer | Nút `[⬇]` | Chỉ cho phép tải file về máy |
| `failed` | `canManage` | Nút `[↻]` + Icon `⚠` đỏ bên phải | Hover icon đỏ xem chi tiết lỗi, click `↻` để thử lại |
| `failed` | Viewer | Nút `[⬇]` mờ disabled + Icon `⚠` đỏ | Tooltip hiển thị lý do lỗi |

---

## 4. Web Design Guidelines Compliance

- [x] **Aria Labels:** Mọi nút icon (`Download`, `RefreshCw`, `Play`) đều có `aria-label` và `title`/tooltip rõ ràng.
- [x] **Focus Visible:** Duy trì ring focus chuẩn (`focus-visible:ring-2 focus-visible:ring-primary-500`).
- [x] **Touch Target:** Các nút bấm trên table cell đáp ứng tối thiểu 36px-44px click area.
- [x] **Color Contrast:** Màu chữ và nền của các Badge (Pending, Ready, Failed, Processing) đáp ứng độ tương phản WCAG AA cả ở Light và Dark mode.
- [x] **Feedback & Toast:** Mọi thao tác đều có Toast phản hồi rõ ràng theo chuẩn `aria-live="polite"`.
