# BA Analysis: ND-MCC đọc sheet MCC và NDFC

**Ngày:** 2026-10-05  
**Feature:** Đổi nguồn dòng bảng kê thô ND-MCC từ `Processed v2` sang sheet `MCC` và `NDFC`, đổi sổ giá clv/uni, đổi cách giữ sheet trong file xuất  
**Module:** Dữ liệu kế toán (`bang_ke_tho` / `accounting_data`)  
**Scope:** FULL — đổi business rule cốt lõi (nguồn dòng, sổ giá, thành phần workbook). Không thêm bảng, cột, API, role, migration.  
**Phụ thuộc:** BA gốc `docs/ba/20260919_bang-ke-tho-nd-mcc-analysis.md`. Engine `backend/src/services/bangKeTho/ndMccEngine.ts`, `pricingLookup.ts`.  
**Nguồn:** Grill 2026-10-05. Đối chiếu file `reference/xu_ly_du_lieu_ke_toan/1-8.7.xlsx`.  
**Ngoài phạm vi:** `frontend/src/utils/processedV2.ts` (xử lý data 5 nhà). Engine CLV và Calofic. Cổng upload đợt vẫn bắt sheet `Processed`.

---

## 1. Tổng quan

Kế toán upload file xử lý data 5 nhà vào **Lên bảng kê thô 5 nhà**, rồi bấm **Xử lý** ở cột ND-MCC. Luồng màn hình, quyền, API và nút tải/chạy lại giữ nguyên.

Thay đổi nằm trong file Excel kết quả:

1. Dòng MCC lấy từ sheet `MCC` (mã `2000000007`). Dòng NDFC lấy từ sheet `NDFC` (mã `2000000008`). Engine không đọc `Processed` và không sinh `Processed v2`.
2. Xóa `backend/src/services/bangKeTho/processedV2.ts` cùng chỗ export và test chỉ phục vụ file đó.
3. Khung giá trên từng dòng nguồn được giữ nguyên khi tra cước. Không tính lại theo tải chuyến, không tô vàng khung giá.
4. Sổ giá của nhóm clv và uni đổi theo mục 3.
5. File xuất giữ các sheet không nằm trong danh sách xóa, rồi thêm đúng 8 sheet xử lý ở cuối.

File mẫu `1-8.7.xlsx` có các sheet: `Sheet1`, `Processed`, `VFM`, `VFM (2)`, `MCC`, `CLV`, `NDFC`, `STHI`, `STHI (uni)`, `NPP`, `TINH`. Header nghiệp vụ của `MCC` và `NDFC` nằm ở dòng 2. Dòng 1 trống.

---

## 2. User stories

| ID | User story | Actor | Quyền |
|---|---|---|---|
| US-01 | Kế toán bấm Xử lý ND-MCC trên đợt có sheet `MCC` và `NDFC`, nhận file đủ 8 sheet xử lý và các sheet được giữ. | Kế toán / Quản trị | `accounting_data.manage` |
| US-02 | Kế toán tải file và thấy đơn giá MCC-clv / MCC (uni) theo sổ `MCC GH`, đơn giá NDFC-clv / NDFC (uni) theo sổ `CLF`. | Kế toán / Viewer | `accounting_data.view` |
| US-03 | Khi file đợt thiếu `MCC` hoặc `NDFC`, cột ND-MCC chuyển lỗi và tooltip nói rõ sheet thiếu. | Kế toán / Quản trị | `accounting_data.manage` |

Các story nút Xử lý, Đang xử lý, Sẵn sàng, Chạy lại, Tải file giữ như BA 2026-09-19.

---

## 3. Business rules

| ID | Quy tắc |
|---|---|
| BR-01 | **Nguồn dòng.** Đọc sheet tên `MCC` và sheet tên `NDFC` (so khớp không phân biệt hoa thường, có trim). Thiếu một sheet thì dừng cả lần xử lý. Dòng đưa vào bảng kê MCC là dòng sheet `MCC` có mã nhà cung cấp `2000000007`. Dòng đưa vào bảng kê NDFC là dòng sheet `NDFC` có mã `2000000008`. Dòng khác mã bị bỏ. |
| BR-02 | **Khối chuyến.** Trên mỗi sheet nguồn, một khối là các dòng dữ liệu liền nhau cùng `Số tàu`. Dòng đầu khối mang giá trị `CLF`, `VFM`, `MCC`, `CLV`, `NDFC`, `GẠO` và cột ngay sau `GẠO` (trên file mẫu là cột 27, header trống). Cột đó là `5 nhà`. Trên file mẫu, cột này bằng tổng sáu cột nhà của cùng dòng (34/34 khối MCC, 34/34 khối NDFC). Các dòng sau trong khối để trống các cột này trên 8 sheet kết quả. Cùng một số tàu có thể có nhiều ngày hóa đơn và vẫn là một khối nếu các dòng liền nhau. |
| BR-03 | **Cờ ghép NDFC.** Sheet `MCC (tt)` dùng sổ `MCC (tt) GHÉP ND` khi cột `NDFC` trên dòng đầu khối của sheet `MCC` lớn hơn 0. Ngược lại dùng sổ `MCC (tt)`. |
| BR-04 | **Khung giá.** Tra cước bằng đúng chữ khung giá trên dòng nguồn. Không suy lại từ tổng 5 nhà. Không tô nền và không gắn note vì khung giá đổi. |
| BR-05 | **Sổ giá.** Cách tách slot giữ như hiện tại (so khớp không phân biệt hoa thường): MCC-clv = `CALOFIC HP` hoặc `CLV`; MCC (uni) = chứa `WH UNIDEPOT` hoặc đúng `UNI`; MCC (tt) = chứa `UNI 1` hoặc đúng `TT`; NDFC-clv = `CALOFIC HP` hoặc `CLV`; NDFC (uni) = chứa `UNI 3` hoặc đúng `UNI`; NDFC (tt) = chứa `UNI 1` hoặc đúng `TT`. Sheet `(goc)` chứa mọi dòng của nhà đó. Sổ giá: MCC-clv và MCC (uni) → `MCC GH`. MCC (tt) → `MCC (tt)` hoặc `MCC (tt) GHÉP ND` theo BR-03. NDFC-clv và NDFC (uni) → `CLF`. NDFC (tt) → `NDFC (TT)`. Không fallback sang `CLV`, `NDFC-naic`, `VP-hiep phuoc`. Không thấy giá thì để trống. Phụ phí bốc xếp, chuyển tải, ghép điểm giữ cách tra `customer_surcharges` hiện tại. |
| BR-06 | **Khách hàng.** Giữ tra `customers` và khớp địa chỉ hiện tại (khớp chính xác, bỏ thửa đất, chuỗi con, token overlap ≥ 75%). Khớp một phần tô vàng `#FFF2CC` và gắn note địa chỉ DB chỉ trên 8 sheet kết quả (ô đại lý, điểm giao thực tế, điểm tính phí, địa chỉ giao hàng). Không sửa nội dung các sheet được giữ. |
| BR-07 | **Workbook xuất.** Xóa đúng các sheet (trim, đúng chữ): `VFM`, `VFM (2)`, `CLV`, `STHI`, `STHI (uni)`, `NPP`, `TINH`. Mọi sheet còn lại giữ nguyên thứ tự và nội dung, gồm `Sheet1`, `Processed`, `MCC`, `NDFC` khi file có chúng. Không tạo sheet `NCC` khi file không có. Không sinh `Processed v2`. Nếu một trong 8 tên đích đã tồn tại thì ghi đè sheet đó. Thêm ở cuối, đúng thứ tự: `MCC (goc)`, `MCC-clv`, `MCC (uni)`, `MCC (tt)`, `NDFC (goc)`, `NDFC-clv`, `NDFC (uni)`, `NDFC (tt)`. Với file mẫu, thứ tự cuối là `Sheet1`, `Processed`, `MCC`, `NDFC`, rồi 8 sheet xử lý. |
| BR-08 | **Cột và công thức 8 sheet.** Giữ layout, công thức Hóa đơn, Round MT, Tấn/Hóa đơn, Tấn/Chuyến, Thành tiền check, Thành tiền hóa đơn, tách Bảng A / Bảng B, dòng Tổng cộng, quy tắc chữ `Pallet` trên sub-sheet như BA 2026-09-19. Giá trị `5 nhà`, `CLF`…`GẠO` lấy từ dòng đầu khối (BR-02), ghi một lần trên dòng đầu khối ở sheet kết quả. `GẠO` đọc từ cột nguồn; file mẫu cột này trống thì ô kết quả trống. |
| BR-09 | **Lỗi thiếu sheet.** HTTP 400, `success: false`. Thiếu mỗi `MCC`: message `File input thiếu sheet MCC`, code `MISSING_MCC_SHEET`. Thiếu mỗi `NDFC`: `File input thiếu sheet NDFC`, code `MISSING_NDFC_SHEET`. Thiếu cả hai: `File input thiếu sheet MCC và NDFC`, code `MISSING_MCC_NDFC_SHEETS`. Cột ND-MCC = `failed`, `error_message` bằng message đó. |
| BR-10 | **Upload đợt.** Giữ kiểm tra hiện tại: file `.xlsx`, tối đa 10 MB, phải có sheet `Processed`. Rule này dùng chung cả đợt, không đổi trong feature này. |
| BR-11 | **Chạy lại.** Giữ BR-08 của BA 2026-09-19: xóa object MinIO cũ, ghi file mới, `status = ready`, xóa `error_message`. |

---

## 4. API

Không thêm endpoint. `POST /api/bang-ke-tho/batches/:id/process-nd-mcc` giữ quyền `accounting_data.manage`.

Thành công 200 giữ envelope và `stats` (`mcc_rows`, `ndfc_rows`, `mcc_invoices`, `ndfc_invoices`).

Lỗi thiếu sheet:

```json
{
  "success": false,
  "message": "File input thiếu sheet MCC",
  "error": { "code": "MISSING_MCC_SHEET" }
}
```

Bỏ mã `MISSING_PROCESSED_SHEET` khỏi luồng xử lý ND-MCC. Mã đó có thể còn ở cổng upload nếu file đợt không có `Processed` (`File phải có sheet “Processed”`).

---

## 5. Acceptance criteria

| ID | Tiêu chí |
|---|---|
| AC-01 | File `1-8.7.xlsx` sau xử lý còn `Sheet1`, `Processed`, `MCC`, `NDFC` đúng thứ tự đầu file, không còn `VFM`, `VFM (2)`, `CLV`, `STHI`, `STHI (uni)`, `NPP`, `TINH`, không có `Processed v2`, không có `NCC`. |
| AC-02 | Tám sheet xử lý đứng cuối file, đúng tên và đúng thứ tự BR-07. |
| AC-03 | Số dòng MCC trên `(goc)` bằng số dòng sheet `MCC` có mã `2000000007`. Số dòng NDFC tương tự với mã `2000000008`. |
| AC-04 | Trên mỗi khối cùng số tàu, `CLF`…`GẠO` và `5 nhà` chỉ có số ở dòng đầu khối và khớp sheet nguồn. Cột sau `GẠO` trên nguồn là `5 nhà`. |
| AC-05 | Khung giá trên sheet kết quả bằng khung giá dòng nguồn. Không có tô vàng vì đổi khung. |
| AC-06 | Dòng MCC slot `CALOFIC HP` và `WH Unidepot` tra sổ `MCC GH`. Dòng NDFC slot `CALOFIC HP` và `UNI 3` tra sổ `CLF`. Dòng MCC slot `UNI 1` tra `MCC (tt)` hoặc `MCC (tt) GHÉP ND` theo cột `NDFC` của dòng đầu khối. Dòng NDFC slot `UNI 1` tra `NDFC (TT)`. |
| AC-07 | Khớp địa chỉ một phần chỉ xuất hiện trên 8 sheet xử lý. Sheet `Processed`, `MCC`, `NDFC`, `Sheet1` không bị tô note mới. |
| AC-08 | Thiếu sheet `MCC`, hoặc `NDFC`, hoặc cả hai thì API 400 với message và code BR-09, cột ND-MCC `failed`. |
| AC-09 | Repo backend `bangKeTho` không còn file `processedV2.ts` và không còn import nó. `frontend/src/utils/processedV2.ts` vẫn tồn tại. |
| AC-10 | Upload file không có sheet `Processed` vẫn bị từ chối như hiện tại. |

---

## 6. UI

Màn `/accounting-data/bang-ke-tho` không đổi layout. Toast lỗi xử lý hiển thị `message` từ API. Tooltip icon lỗi trên cột ND-MCC hiển thị cùng chuỗi. Chi tiết ở UI spec cùng ngày.
