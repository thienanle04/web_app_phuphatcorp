# Tasks: Cập nhật chức năng Xử lý data 5 nhà (Delivery Data Processing)
**Ngày:** 2026-09-21  
**Brief:** `docs/light/20260921_update-xu-ly-data-5-nha-brief.md`  

---

## Danh sách công việc (LIGHT Tasks)

| ID | Tầng | Task | Chi tiết kỹ thuật | Effort |
|----|------|------|-------------------|--------|
| L-01 | FE | Cắt hậu tố `"/L2"` trong `normalizeVehicle` | Bổ sung kiểm tra 3 ký tự cuối `soTauXe.length >= 3 && soTauXe.toUpperCase().slice(-3) === '/L2'` thì cắt 3 ký tự cuối (`slice(0, -3)`), song song với logic cắt 4 ký tự `' /L2'` hiện có. | S |
| L-02 | FE | Trích xuất `rawSheetData` trong `parseDeliveryFile` | Mở rộng interface `ParsedFileData` thêm trường `rawSheetData: RawRow[]`. Trong `parseDeliveryFile`, lưu lại toàn bộ `rawData` (các dòng đọc từ worksheet gốc) để chuyển tiếp sang bước xuất file. | S |
| L-03 | FE | Thêm sheet `"Sheet"` ở đầu Workbook output | Trong `processDeliveryDataFromRows`, thêm tham số `rawSheetData?: RawRow[]`. Trước khi thêm sheet `Processed`, tạo worksheet đầu tiên tên `"Sheet"`. Điền toàn bộ dữ liệu từ `rawSheetData` (hoặc `[RAW_HEADERS, ...dataRows]` nếu xử lý batch). | S |
| L-04 | FE | Format Number cho các cột O, P, Q | Xây dựng helper `parseCellNumber` an toàn. Trong `mapRowToOutput`, chuyển đổi giá trị cột O (*Số lượng*), P (*SP Trọng lượng net*), Q (*HĐ Trọng lượng net*) sang kiểu `number` (hoặc `""` nếu rỗng). Đảm bảo trong `writeSheetRows`, các cell này mang kiểu số thực sự và nhận đúng `cell.numFmt` (`#,##0` cho O, `#,##0.000` cho P và Q) trên cả sheet `Processed` và 5 sheet nhà con. | M |
| L-05 | FE | Cập nhật `DeliveryDataPage.tsx` | Nhận `rawSheetData` từ `parseDeliveryFile` và truyền vào `processDeliveryDataFromRows` khi thực hiện `runProcess`. | S |
| L-06 | QA | Kiểm thử xác thực | Chạy `npm run typecheck` và `npm run lint`. Kiểm tra kết quả xuất Excel với dữ liệu mẫu đảm bảo sheet đầu tiên tên "Sheet", các cột O, P, Q là number có format số, và biển số có đuôi `/L2` được cắt chuẩn xác. | S |

---

## Thứ tự thực hiện

```
L-01 (normalizeVehicle) → L-02 (rawSheetData) → L-03 (Sheet đầu tiên) → L-04 (Format O, P, Q) → L-05 (DeliveryDataPage) → L-06 (QA & Verify)
```
