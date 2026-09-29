# Brief: Cập nhật chức năng Xử lý data 5 nhà (Delivery Data Processing)
**Ngày:** 2026-09-21  
**Loại:** LIGHT  
**Feature:** Xử lý data 5 nhà (`/delivery-data/5-houses`)  

---

## 1. Tóm tắt yêu cầu (Shared Understanding)

Dựa trên kết quả phỏng vấn làm rõ yêu cầu (/grill-me):
1. **Thêm sheet "Sheet" vào file output**:
   - Vị trí: Đứng đầu tiên trong Workbook output (trước sheet `Processed`).
   - Tên sheet: `"Sheet"`.
   - Nội dung: Chứa nguyên vẹn dữ liệu gốc (raw data) của sheet đầu tiên từ file Excel input tải lên (bao gồm các dòng metadata/tiêu đề và toàn bộ các dòng dữ liệu thô ban đầu). Đối với trường hợp xử lý batch từ database, ghi tiêu đề cột gốc `RAW_HEADERS` cùng danh sách dữ liệu thô.
2. **Format Number cho các cột O, P, Q**:
   - Áp dụng đồng bộ cho sheet `Processed` và 5 sheet nhà con (`CLF`, `VFM`, `MCC`, `CLV`, `NDFC`).
   - Cột O (*Số lượng / DVT bán hàng*): Parse về kiểu `number`, format số nguyên `#,##0`.
   - Cột P (*SP Trọng lượng net*): Parse về kiểu `number`, format số thập phân 3 chữ số `#,##0.000`.
   - Cột Q (*HĐ Trọng lượng net*): Parse về kiểu `number`, format số thập phân 3 chữ số `#,##0.000`.
   - Ô trống / null / undefined: Giữ nguyên ô trống `""` (không điền 0).
   - Đảm bảo kiểu dữ liệu trong cell là `number` thực sự để Excel không báo lỗi "Number stored as text" và người dùng có thể thực hiện hàm tính toán (SUM, AVERAGE...) trực tiếp.
3. **Bổ sung cắt hậu tố "/L2" ở Số tàu / Số xe**:
   - Trong hàm `normalizeVehicle`:
     - Giữ nguyên kiểm tra 4 ký tự cuối: `soTauXe.slice(-4) === ' /L2'` -> cắt bỏ 4 ký tự cuối (`.slice(0, -4)`).
     - Bổ sung thêm kiểm tra 3 ký tự cuối: nếu 3 ký tự cuối là `'/L2'` (không phân biệt hoa thường `toUpperCase().slice(-3) === '/L2'`) -> cắt bỏ 3 ký tự cuối (`.slice(0, -3)`).

---

## 2. Files ảnh hưởng

| File | Loại thay đổi | Chi tiết |
|------|---------------|----------|
| `frontend/src/utils/processDeliveryData.ts` | Cập nhật | 1. Cập nhật `normalizeVehicle` thêm dò 3 ký tự cuối `/L2`.<br>2. Cập nhật `parseDeliveryFile` trích xuất và trả về `rawSheetData`.<br>3. Cập nhật `processDeliveryDataFromRows` nhận `rawSheetData`, thêm sheet `"Sheet"` ở vị trí đầu tiên trong Workbook.<br>4. Parse giá trị cột O, P, Q sang kiểu `number` trước khi đưa vào hàng output, áp dụng format số cho `Processed` và 5 sheet nhà. |
| `frontend/src/pages/admin/DeliveryDataPage.tsx` | Cập nhật | Lưu `rawSheetData` từ `parseDeliveryFile` và truyền vào `processDeliveryDataFromRows`. |

---

## 3. Rủi ro & Giải pháp

- **Rủi ro:** Khi parse số lượng/trọng lượng từ chuỗi có chứa dấu phẩy/chấm theo định dạng tiếng Việt hoặc tiếng Anh (ví dụ `"1,250"` vs `"1.250"`).
- **Giải pháp:** Sử dụng helper parse số chuẩn mực (tương tự như `parseCellToNumber` trong `processedV2.ts`), loại bỏ khoảng trắng, chuẩn hóa dấu thập phân và dấu phân tách hàng nghìn trước khi chuyển đổi kiểu.
