# BA Analysis: Module Xử lý Bảng Kê Thô ND-MCC (MCC & NDFC)

**Ngày:** 2026-09-19  
**Feature:** Tự động hóa bóc tách và sinh bảng kê thô nhà ND-MCC (MCC & NDFC) từ file input đợt 5 nhà  
**Module:** Dữ liệu kế toán (`bang_ke_tho` / `accounting_data`)  
**Scope:** FULL (Backend Service, Database Lookup, Excel Generation via ExcelJS, Frontend Trigger & Download)  
**Phụ thuộc:** `bang_ke_tho_batches`, `bang_ke_tho_outputs`, `customers`, `route_pricing`, `customer_surcharges`, MinIO bucket `phuphatcorp-bang-ke-tho`  
**Nguồn:** Grilling 2026-09-19; Phân tích dữ liệu thực tế từ `reference/xu_ly_du_lieu_ke_toan/ND-MCC 30.6.xlsx` & `ND-MCC 1-16.7.xlsx`

---

## 1. Tổng quan & Mục tiêu

Sau khi người dùng upload file đã xử lý dữ liệu 5 nhà (chứa sheet `Processed` và `Sheet1`) vào hệ thống **Lên bảng kê thô 5 nhà** (`/accounting-data/bang-ke-tho`), cột **ND-MCC** ban đầu ở trạng thái `pending` ("Chưa xử lý").

Module **Xử lý bảng kê thô ND-MCC** cho phép:
1. Kích hoạt tiến trình sinh bảng kê thô ND-MCC từ file input đã lưu trên MinIO của đợt.
2. Bóc tách dữ liệu theo 2 nhà cung cấp:
   - **MCC:** Mã nhà cung cấp `2000000007`
   - **NDFC:** Mã nhà cung cấp `2000000008`
3. Tra cứu thông tin khách hàng từ DB:
   - Đại lý (`diem_tra_hang`)
   - Điểm giao hàng thực tế (`tuyen_phuong`)
   - Điểm giao hàng tính phí (`diem_giao_hang_tinh_phi`)
4. Tự động tra cứu đơn giá vận chuyển và phụ phí từ cơ sở dữ liệu:
   - Bảng giá cước vận tải (`route_pricing`) theo Tuyến tính phí + Khung giá + Ngày hóa đơn.
   - Biểu phụ phí giao hàng (`customer_surcharges` / bảng biểu phí) theo Khách hàng / Đại lý / Vùng / Khung tải.
   - Nếu không tìm thấy giá: để trống cho kế toán bổ sung thủ công.
5. Tạo ra 9 sheets nghiệp vụ kết quả được gắn thêm vào workbook gốc (tổng cộng 12 sheets chuẩn):
   - `Processed v2`: Bản sao chuẩn hóa từ `Processed` (chuyển đổi số kiểu text thành number, hoán đổi cột 5 nhà trước CLF, thêm cột Gạo, tính lại Khung giá theo tải trọng chuyến trên cột 5 nhà, highlight và note khi có thay đổi).
   - `MCC (goc)`: Chi tiết từng dòng sản phẩm của MCC (68 cột, công thức tính Trọng lượng Net/Chuyến/Hóa đơn, Thành tiền check & Thành tiền hóa đơn).
   - `MCC-clv`: Tổng hợp theo chuyến/hóa đơn nhánh kho Hiệp Phước (Slot `CALOFIC HP`).
   - `MCC (uni)`: Tổng hợp theo chuyến/hóa đơn nhánh kho Unidepot (Slot `WH Unidepot`, Site `UNI-MCC`).
   - `MCC (tt)`: Tổng hợp theo chuyến/hóa đơn nhánh tiếp thị / chuyển tải (Slot `UNI 1`).
   - `NDFC (goc)`: Chi tiết từng dòng sản phẩm của NDFC (68 cột).
   - `NDFC-clv`: Tổng hợp nhánh kho Hiệp Phước (Slot `CALOFIC HP`).
   - `NDFC (uni)`: Tổng hợp nhánh kho Unidepot (Slot `UNI 3`, Site `UNI-NDFC`).
   - `NDFC (tt)`: Tổng hợp nhánh tiếp thị / chuyển tải (Slot `UNI 1`).
6. Lưu workbook hoàn chỉnh vào MinIO tại `batches/{batch_id}/outputs/nd_mcc.xlsx` với tên download chuẩn `ND-MCC {stem}.xlsx`, cập nhật trạng thái `ready` (hoặc `failed` kèm lỗi cụ thể).

---

## 2. User Stories

| ID | User Story | Actor | Quyền hạn |
|---|---|---|---|
| US-01 | Kế toán xem danh sách đợt thấy nút "Xử lý" tại cột ND-MCC khi ở trạng thái `pending` hoặc `failed`. | Kế toán / Quản trị | `accounting_data.manage` |
| US-02 | Kế toán bấm "Xử lý" (hoặc "Chạy lại" khi đã `ready`), hệ thống hiển thị trạng thái đang xử lý (loading spinner) và gọi API backend thực hiện tiến trình. | Kế toán / Quản trị | `accounting_data.manage` |
| US-03 | Khi xử lý thành công, cột ND-MCC chuyển sang trạng thái "Sẵn sàng" (`ready`), hiển thị nút "Tải file" và nút "Chạy lại". | Kế toán / Viewer | `accounting_data.view` (tải) / `manage` (chạy lại) |
| US-04 | Khi có lỗi xảy ra trong quá trình xử lý, hệ thống chuyển sang badge "Lỗi" (`failed`), hiển thị tooltip giải thích nguyên nhân lỗi và cho phép bấm "Chạy lại". | Kế toán / Quản trị | `accounting_data.manage` |
| US-05 | Người dùng có quyền xem tải file kết quả `ND-MCC {original_stem}.xlsx` với đầy đủ công thức và các sheet phân loại. | Mọi user có quyền view | `accounting_data.view` |

---

## 3. Quy tắc Phân loại Sheets & Dữ liệu (Business Rules)

| ID | Quy tắc |
|---|---|
| BR-01 | **Nhận diện dữ liệu:** Dữ liệu nguồn được đọc từ sheet `Processed` của file input trong đợt.<br>- MCC: Dòng có `Mã nhà cung cấp` = `'2000000007'` (hoặc tên tương đương).<br>- NDFC: Dòng có `Mã nhà cung cấp` = `'2000000008'`. |
| BR-02 | **Phân loại Sub-sheet theo Slot & Site:**<br>- **CLV:** Slot = `'CALOFIC HP'` (hoặc các slot xuất trực tiếp từ nhà máy chính). Tên sheet: `MCC-clv` và `NDFC-clv`.<br>- **UNI:** MCC lấy Slot = `'WH Unidepot'` (Site `'UNI-MCC'`); NDFC lấy Slot = `'UNI 3'` (Site `'UNI-NDFC'`). Tên sheet: `MCC (uni)` và `NDFC (uni)`.<br>- **TT:** Slot = `'UNI 1'`. Tên sheet: `MCC (tt)` và `NDFC (tt)`. |
| BR-03 | **Khách hàng Mapping & Smart Address Matching:**<br>- Tra cứu bảng `customers` theo cặp `(ten_khach_hang, dia_chi_giao_hang)`. Ưu tiên rule khớp theo `supplier_code` cho MCC/NDFC khi slot = `'UNI 1'`.<br>- **Cơ chế so khớp địa chỉ linh hoạt (`addressMatcher`):**<br>  1. So khớp chính xác sau khi chuẩn hóa dấu, khoảng trắng (`normalizeAddressKey`).<br>  2. Loại bỏ tiền tố thửa đất/số lô (ví dụ: `thửa đất số 2132`).<br>  3. So khớp chuỗi con (`substring match`) và so khớp độ trùng lặp từ khóa (`token overlap >= 75%`).<br>- **Đánh dấu Khớp một phần (Partial Match):** Khi khách hàng khớp qua cơ chế chuỗi con hoặc token overlap, ô `Địa chỉ giao hàng` trên cả sheet `Processed` và `Processed v2` sẽ được tô nền vàng nhạt (`#FFF2CC`) và gắn Cell Note ghi rõ địa chỉ gốc tìm thấy trong DB để kế toán dễ dàng đối chiếu kiểm tra.<br>- Trích xuất thông tin khách hàng: Đại lý (`diem_tra_hang`), Điểm giao hàng thực tế (`tuyen_phuong`), Điểm giao hàng tính phí (`diem_giao_hang_tinh_phi`). |
| BR-04 | **Tra cứu Giá cước & Phụ phí:**<br>- **Đơn giá vận chuyển:** Khớp theo Điểm tính phí (`diem_giao_hang_tinh_phi`), Khung giá tải xe (`Khung giá`), Ngày hóa đơn (`Ngay_HD`) từ bảng giá `route_pricing`.<br>  - **Sheet MCC-clv:** Lấy giá trong bảng giá `CLV`.<br>  - **Sheet MCC (uni):** Tra cứu bảng giá `MCC GH`.<br>  - **Sheet MCC (tt):** Tra cứu bảng giá `MCC (tt)`. Nếu chuyến đó có trọng lượng NDFC (trên cùng chuyến xe + ngày hóa đơn) thì lấy bảng giá `MCC (tt) GHÉP ND`.<br>  - **NDFC sheets:** Slot TT lấy `NDFC (TT)`; các slot khác lấy `NDFC-naic` (fallback `VP-hiep phuoc`, `CLF`).<br>  - Nếu không tìm thấy giá: để trống cho kế toán bổ sung thủ công.<br>- Phí bốc xếp / Chuyển tải / Phụ phí: Tra cứu theo Khách hàng / Đại lý / Khung tải từ `customer_surcharges`. Nếu không tìm thấy, để ô trống `null`. |
| BR-05 | **Cấu trúc Sheet Gốc (68 cột):**<br>- Cột 1 đến 8: Mã NCC, Số HĐ, Ngày HĐ, Số xe, Mã KH, Đại lý, Điểm giao hàng thực tế, Điểm giao hàng tính phí.<br>- Cột 9 (Hóa đơn): `=G3&", ("&L3&"), xe "&D3`<br>- Cột 10 đến 21: Tên KH, Địa chỉ, Khung giá, ĐVT, Mã hàng, Tên hàng Vie, Tên hàng En, Mã LH, ĐVT bán hàng, Số lượng, SP Trọng lượng Net, HĐ Trọng lượng Net.<br>- Cột 22 (Round MT): `=ROUND(U3/1000, 3)`<br>- Cột 23 (Tấn/Hóa đơn): `=(IF($B3=$B2, 0, SUMIF($B:$B, $B3, $V:$V)))`<br>- Cột 24 (Tấn/Chuyến): `=+IF(AND(D3=D2, C3=C2), 0, SUMIFS($V:$V, $C:$C, $C3, $D:$D, $D3))`<br>- Cột 25: Tổng trọng lượng chuyến (`=AL3`)<br>- Cột 26 đến 29: Đơn giá vận chuyển, Phí bốc xếp, Phí chuyển tải, Phí ghép điểm.<br>- Cột 30 (Thành tiền check): `=ROUND(X3*SUM(Z3:AB3), 0)`<br>- Cột 31 (Thành tiền hóa đơn): `=ROUND(X3*Z3, 0)`<br>- Cột 34 (SITE), Cột 35 (KHU VỰC): `ST` nếu kênh siêu thị, `TINH` nếu đi tỉnh.<br>- Cột 38 (5 nhà): `=SUM(AM3:AR3)` |
| BR-06 | **Cấu trúc Sub-sheet Tóm tắt (CLV, UNI, TT):** Thu gọn theo từng dòng Hóa đơn (1 dòng / hóa đơn), tổng hợp số liệu trọng lượng hóa đơn và trọng lượng chuyến tương ứng.<br>- **Quy tắc Khung giá:** Các dòng có khung giá gốc chứa `+ Pallet` hoặc từ khóa `pallet` ở sheet `(goc)` thì qua các sub-sheet (`MCC-clv`, `MCC (uni)`, `MCC (tt)`, `NDFC-clv`, `NDFC (uni)`, `NDFC (tt)`) chỉ ghi giá trị text là `'Pallet'`. Cột Hóa đơn (cột 8) tham chiếu cột Khung giá (cột 11) sẽ tự động hiển thị `(Pallet)`. Đồng thời ô cột 11 được gắn Note lưu trữ khung giá chi tiết ban đầu (ví dụ `>8-16 tấn + Pallet`) để tiện đối soát. |
| BR-07 | **Toàn vẹn Workbook Output & Thứ tự Sheets:** File output xuất đúng 12 sheets theo thứ tự chuẩn:<br>1. `NCC`<br>2. `Sheet1`<br>3. `Processed`<br>4. `Processed v2`<br>5. `MCC (goc)`<br>6. `MCC-clv`<br>7. `MCC (uni)`<br>8. `MCC (tt)`<br>9. `NDFC (goc)`<br>10. `NDFC-clv`<br>11. `NDFC (uni)`<br>12. `NDFC (tt)`<br>- Các sheets cơ sở `NCC`, `Sheet1`, `Processed`, `Processed v2` được bảo toàn (nếu `NCC`/`Sheet1` chưa có sẽ được khởi tạo).<br>- Các sheets ngoài phạm vi (như `VFM`, `CLV`, `STHI`, `Process 1-8`, `Sheet31-8`, v.v.) được loại bỏ khỏi output. |
| BR-08 | **Xử lý Chạy lại (Re-run):** Khi bấm "Chạy lại", hệ thống xóa object output cũ trên MinIO (nếu có), ghi đè file mới, cập nhật `bang_ke_tho_outputs` với `status = 'ready'`, `generated_at = NOW()`, `error_message = NULL`. |
| BR-09 | **Phân tách Khung giá <= 2.5 tấn và các khung giá còn lại (> 2.5 tấn) trên cùng Sheet:**<br>- Áp dụng cho cả sheet Gốc (`MCC (goc)`, `NDFC (goc)`) và các sheet Tóm tắt (`MCC-clv`, `MCC (uni)`, `MCC (tt)`, `NDFC-clv`, `NDFC (uni)`, `NDFC (tt)`).<br>- **Bảng A (> 2.5 tấn: `>8-16 tấn`, `>16-23 tấn`, `Pallet`...):** Nhóm theo chuyến xe (`truckNo` + `invoiceDateIso`). Ngay sau mỗi chuyến xe có dòng `Tổng cộng` từng xe. Cuối Bảng A có dòng `TỔNG CỘNG A` với công thức chia đôi `=SUM(...)/2`.<br>- **Khoảng cách:** 6 dòng trống giữa Bảng A và Bảng B.<br>- **Bảng B (`≤2.5 tấn`):** Lặp lại dòng Header, hiển thị danh sách hóa đơn liên tục và kết thúc bằng dòng `TỔNG CỘNG B` với công thức `=SUM(...)` tính trực tiếp.<br>- **Sheet chỉ có 1 nhóm dữ liệu:** Nếu sheet chỉ có `≤2.5 tấn` (như sheet UNI), chỉ hiển thị Bảng B kèm dòng `TỔNG CỘNG B` (không render Bảng A rỗng). |
| BR-10 | **Sheet Processed v2 (Chuẩn hóa số liệu & Khung giá tải trọng):**<br>- Nhân bản trực tiếp từ sheet `Processed` gốc.<br>- **Ép kiểu số:** Chuyển đổi các cột Số lượng (cột O), SP Trọng lượng Net (cột P), HĐ Trọng lượng Net (cột Q) từ dạng text (chứa dấu phẩy, khoảng trắng) sang kiểu dữ liệu số thực (`number`), áp dụng format `#,#0` hoặc `#,##0.000`.<br>- **Bố trí lại cột:** Chuyển cột `5 nhà` về trước cột `CLF` (header styled nền xanh lá `#00B050`, chữ trắng in đậm đồng bộ cột CLF), bổ sung thêm cột `Gạo` ngay sau cột `NDFC`.<br>- **Xác định lại Khung giá theo tải trọng thực:** Căn cứ vào trọng lượng tổng chuyến trên cột `5 nhà` (từ dòng tổng chuyến xe hoặc tổng nhóm hóa đơn) để suy ra khung giá chuẩn (`≤2.5 tấn`, `>2.5-8 tấn`, `>8-16 tấn`, `>16-23 tấn`, `Pallet` / `>... + Pallet`). Nếu khung giá bị thay đổi so với file gốc, ô được tô màu vàng nhạt (`#FFE599`) và gắn Cell Note lưu giá trị khung giá ban đầu để tiện kiểm tra. |

---

## 4. Thiết kế API Contract

### 4.1 Trigger Xử lý ND-MCC
```http
POST /api/bang-ke-tho/batches/:id/process-nd-mcc
Authorization: Bearer <access_token>
```
- **Phân quyền:** `accounting_data.manage` hoặc `ADMIN`
- **Response Success (200 OK):**
```json
{
  "success": true,
  "message": "Xử lý bảng kê thô ND-MCC thành công",
  "data": {
    "batch_id": "uuid",
    "house_code": "nd_mcc",
    "status": "ready",
    "download_filename": "ND-MCC 1-8.7.xlsx",
    "generated_at": "2026-09-19T00:50:00.000Z",
    "stats": {
      "mcc_rows": 298,
      "ndfc_rows": 393,
      "mcc_invoices": 86,
      "ndfc_invoices": 78
    }
  }
}
```
- **Response Error (400 / 422 / 500):**
```json
{
  "success": false,
  "message": "Không tìm thấy sheet Processed trong file input của đợt",
  "error": {
    "code": "MISSING_PROCESSED_SHEET"
  }
}
```

### 4.2 Tải file output ND-MCC
(Đã định nghĩa trong BE-06 / API GET `/api/bang-ke-tho/batches/:id/outputs/nd_mcc`)
- **Phân quyền:** `accounting_data.view`
- Trả về binary stream `.xlsx` với header `Content-Disposition: attachment; filename="ND-MCC 1-8.7.xlsx"`.
