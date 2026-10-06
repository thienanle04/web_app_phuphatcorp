# UI Spec: ND-MCC đọc sheet MCC và NDFC
**Ngày:** 2026-10-05  
**BA Doc:** `docs/ba/20261005_nd-mcc-mcc-ndfc-source-analysis.md`  
**Role liên quan:** `accounting_data.view` (xem, tải), `accounting_data.manage` (xử lý, chạy lại). ADMIN toàn quyền.  
**Guidelines:** Đối chiếu Vercel Web Interface Guidelines (bản fetch 2026-10-05). Feature này không thêm màn, modal, nút, hay layout.

---

## 1. User Journey

### Happy Path
```
Sidebar → Dữ liệu kế toán → Lên bảng kê thô 5 nhà (/accounting-data/bang-ke-tho)
  → Bảng đợt đã có (skeleton khi đang tải)
  → Cột ND-MCC của đợt có sheet MCC và NDFC đang pending: nút "Xử lý"
  → User bấm "Xử lý"
  → Ô cột hiện spinner và chữ "Đang xử lý…"
  → API 200
  → Toast: bangKeTho.message.success.processNdMcc với tên file tải về
  → Ô cột còn nút Tải file và nút Chạy lại
  → User bấm Tải file → trình duyệt tải ND-MCC {stem}.xlsx
```

Nội dung file tải về theo BA (8 sheet xử lý thêm ở cuối, các sheet được giữ, các sheet bị xóa). Giao diện danh sách không mô tả từng sheet Excel.

### Alternative Paths
```
- User bấm Chạy lại khi cột đã ready → cùng trạng thái "Đang xử lý…" → toast thành công → vẫn hai nút Tải file và Chạy lại
- User chỉ có quyền view, cột pending hoặc failed → nút tải mờ, không có nút Xử lý
- User chỉ có quyền view, cột ready → chỉ nút Tải file
```

### Error Paths
```
- File đợt thiếu sheet MCC, hoặc NDFC, hoặc cả hai
  → API 400, message BR-09 của BA
  → Toast lỗi = message của API (fallback bangKeTho.message.error.processNdMcc nếu response không có message)
  → Cột ND-MCC: nút Chạy lại + icon cảnh báo
  → Tooltip và aria-label của icon = error_message (đúng câu message API)
- Lỗi 500 hoặc file hỏng → toast message API hoặc fallback processNdMcc, cột failed, chạy lại được
- 401 → redirect đăng nhập (hành vi axios hiện tại)
- 403 → toast bangKeTho.message.error.forbidden
```

---

## 2. Screen Inventory

### Screen 1: Lên bảng kê thô 5 nhà
**Route:** `/accounting-data/bang-ke-tho`  
**Role:** view để xem và tải; manage để xử lý, chạy lại, upload, xóa  
**Điều kiện hiển thị:** Giữ nguyên trang hiện tại. Không thêm vùng, cột, modal.

#### Layout
Giữ layout đang chạy: tiêu đề trang, ô tìm, dropzone upload (khi có quyền manage), bảng đợt với cột ND-MCC / CLV / Calofic / thao tác.

Ô cột ND-MCC giữ bốn trạng thái đã có trong `BangKeThoHouseCell`:

```
Pending + manage:  [Xử lý]
Pending + view:    [Tải] mờ
Processing:        [spinner] Đang xử lý…
Ready:             [Tải] [Chạy lại]
Failed:            [Chạy lại] [icon cảnh báo]
```

#### States
| State | Trigger | UI hiển thị |
|---|---|---|
| Loading | Đang tải danh sách đợt | Skeleton bảng hiện có |
| Empty | Không có đợt | Câu `bangKeTho.empty` hiện có |
| Error | Tải danh sách lỗi | `bangKeTho.error` + nút thử lại hiện có |
| Populated | Có đợt | Bảng hiện có |
| Processing ND-MCC | Bấm Xử lý hoặc Chạy lại | Spinner + `bangKeTho.house.processing` |
| Failed ND-MCC | API lỗi, gồm thiếu sheet MCC/NDFC | Nút chạy lại + icon cảnh báo, tooltip = `error_message` |

#### Actions
| Action | Trigger | Kết quả |
|---|---|---|
| Xử lý / Chạy lại | Click nút cột ND-MCC | POST process-nd-mcc. Thành công thì toast success và refresh dòng. Thất bại thì toast message API và cột failed. |
| Tải file | Click nút tải khi ready | Tải xlsx, không đổi layout |

Không có screen 2. Không có modal mới.

---

## 3. Component Checklist

| Component | File | Loại | Dùng ở |
|---|---|---|---|
| BangKeThoHouseCell | `frontend/src/components/bang-ke-tho/BangKeThoHouseCell.tsx` | Giữ nguyên | Cột ND-MCC. Tooltip lỗi đã bind `house.error_message`. |
| BangKeThoPage | `frontend/src/pages/admin/accounting-data/BangKeThoPage.tsx` | Giữ nguyên | Toast dùng `apiMessage(err, t('bangKeTho.message.error.processNdMcc'))`. |

Không tạo component mới. Không đổi class, kích thước nút, icon.

States bắt buộc của trang danh sách đã có trên page hiện tại (loading, empty, error, toast, nút khóa khi đang submit). Feature này không thêm hành động xóa mới nên không thêm confirm dialog.

---

## 4. Validation UX

| Trường hợp | Hiển thị ở đâu | Khi nào | Message |
|---|---|---|---|
| Thiếu sheet MCC | Toast + tooltip icon lỗi cột ND-MCC | Sau khi bấm Xử lý / Chạy lại | `File input thiếu sheet MCC` |
| Thiếu sheet NDFC | Toast + tooltip | Sau khi bấm Xử lý / Chạy lại | `File input thiếu sheet NDFC` |
| Thiếu cả hai | Toast + tooltip | Sau khi bấm Xử lý / Chạy lại | `File input thiếu sheet MCC và NDFC` |
| Upload không có sheet Processed | Toast lỗi upload hiện có | Khi lưu đợt | Giữ message upload hiện tại. Không đổi copy. |
| 500 | Toast | Sau khi xử lý | Message API, hoặc `bangKeTho.message.error.processNdMcc` |
| 403 | Toast | Sau khi xử lý | `bangKeTho.message.error.forbidden` |
| 401 | Redirect login | Khi nhận 401 | — |

Message thiếu sheet do backend trả về. Frontend không tự ghép câu.

---

## 5. i18n

Không thêm key. Các chuỗi trang giữ catalog `bangKeTho.*` trong `frontend/src/i18n/vi.json` và `en.json`.

Ba câu thiếu sheet là `message` của API (tiếng Việt, đúng BR-09), không đưa vào catalog frontend. Toast fallback khi không có message vẫn là:

```
bangKeTho.message.error.processNdMcc = "Xử lý bảng kê ND-MCC thất bại"
bangKeTho.message.success.processNdMcc = "Xử lý bảng kê ND-MCC \"{filename}\" thành công"
```

---

## 6. Web Interface Guidelines

Đối chiếu guideline fetch ngày 2026-10-05 với phạm vi UI của feature (chỉ copy lỗi API trên toast và tooltip đã có):

- Nút icon cột ND-MCC đã có `aria-label`. Icon cảnh báo failed đã có `aria-label` từ `error_message`.
- Chữ đang xử lý đã kết thúc bằng `…`.
- Toast lỗi là thông báo bất đồng bộ; trang đã dùng cơ chế toast hiện có. Không thêm toast mới.
- Không thêm input, animation, ảnh, hay điều hướng.
- Câu lỗi nêu sheet cần có để người dùng biết việc cần sửa trên file đợt, rồi bấm Chạy lại — đúng hướng “error includes the next step” ở mức message nghiệp vụ đã chốt trong BA.
- Không áp Title Case tiếng Anh lên câu tiếng Việt đang dùng trong sản phẩm.

Không có hạng mục UI cần sửa để đạt guideline trong phạm vi feature này.
