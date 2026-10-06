# Brief: Chèn Sheet "Processed v2" vào Chức năng Xử lý Data 5 nhà
**Ngày:** 2026-10-02  
**Loại:** LIGHT  
**Feature:** Xử lý data 5 nhà (`/delivery-data/5-houses`) & Xử lý Batch Data Import (`/accounting/delivery-data/import`)

---

## 1. Tóm tắt yêu cầu (Shared Understanding)

Dựa trên kết quả phỏng vấn làm rõ yêu cầu (/grill-me):
1. **Vị trí và Thứ tự Sheet trong Workbook output**:
   - Thêm sheet `"Processed v2"` ngay sau sheet `"Processed"`.
   - Thứ tự chuẩn 8 sheets trong file Excel tải về:
     `Sheet` (dữ liệu thô gốc) ➔ `Processed` ➔ `Processed v2` ➔ `CLF` ➔ `VFM` ➔ `MCC` ➔ `CLV` ➔ `NDFC`.
2. **Quy tắc và nội dung chuẩn hóa của `Processed v2`**:
   - Nhân bản trực tiếp từ sheet `Processed`.
   - Cột 1 đến 18: Giữ nguyên thứ tự và giá trị từ sheet `Processed`.
   - Cột 19: Cột `5 nhà` (chuyển từ cột X cũ lên trước cột `CLF`). Header mang màu xanh lá `#00B050`, text màu trắng in đậm.
   - Cột 20 - 24: Lần lượt là `CLF`, `VFM`, `MCC`, `CLV`, `NDFC`.
   - Cột 25: Cột `Gạo` (cột mới ngay sau NDFC, định dạng số `#,#00.000`, giá trị mặc định để trống).
   - Cột 26: Cột `Tài xế`.
   - Cột 27 trở đi: Các cột còn lại phía sau `Tài xế`.
   - **Ép kiểu dữ liệu số (`number`)**: Các cột Số lượng (cột O, format `#,##0`), SP Net (cột P, format `#,##0.000`), HĐ Net (cột Q, format `#,##0.000`), và các cột trọng lượng (19..25 gồm 5 nhà, các NCC, Gạo).
   - **Tính lại Khung giá theo tải trọng chuyến**:
     - Căn cứ theo tổng trọng lượng chuyến xe từ cột `5 nhà`:
       - `≤ 2.5 tấn`
       - `>8-16 tấn`
       - `>16-23 tấn`
       - `>23 tấn`
       - Pallet: ghi `Pallet`.
     - Tải chuyến trong khoảng (2,5–8] và không phải Pallet: giữ nguyên khung trên sheet `Processed`, không tô vàng.
     - Nếu Khung giá tính lại khác với Khung giá ban đầu: ô được tô nền màu vàng nhạt `#FFE599` và gắn Cell Note ghi rõ khung giá gốc.
     - Khối khung `≤2.5 tấn` liền kề (phía trên hoặc phía dưới) một khối cùng biển số, cùng ngày, tải chuyến > 2,5 tấn: không đổi khung, đơn vị tính, hay tổng chuyến. Tô cột Khung giá nền `#F8CBAD` và ghi chú chuyến kề. Dòng 1 của sheet luôn là danh sách số hóa đơn cần kiểm tra, hoặc `Cần kiểm tra tách chuyến: không có`.
3. **Đảm bảo không ảnh hưởng đến chức năng Data import**:
   - Sheet đầu tiên của workbook output luôn là sheet `"Sheet"` (dữ liệu thô nguyên bản), bảo đảm tương thích hoàn toàn nếu file được upload vào API import (`POST /api/delivery-data/import`).
   - Khi chạy "Xử lý data" từ các batch đã lưu trong DB trên trang `DeliveryImportPage`, hàm `processDeliveryDataFromRows` xuất file đồng bộ có `Processed v2` an toàn mà không phát sinh lỗi.
   - Giữ nguyên cơ chế tương thích an toàn với Bảng kê thô ND-MCC trên backend.

---

## 2. Files ảnh hưởng

| File | Loại thay đổi | Chi tiết |
|------|---------------|----------|
| `frontend/src/utils/processDeliveryData.ts` | Cập nhật | 1. Tích hợp helper chuẩn hóa `generateProcessedV2Sheet` tương tự quy chuẩn đã có.<br>2. Chèn sheet `Processed v2` ngay sau sheet `Processed` tại Step 5 trong `processDeliveryDataFromRows`.<br>3. Đảm bảo cấu trúc styling, định dạng số, tô màu cell note khi đổi khung giá. |
| `frontend/src/pages/admin/DeliveryDataPage.tsx` | Kiểm tra | Xác nhận luồng chạy và tải file hoạt động mượt mà. |
| `frontend/src/pages/admin/accounting-data/DeliveryImportPage.tsx` | Kiểm tra | Xác nhận luồng xử lý batch từ DB xuất file đồng bộ thành công. |

---

## 3. Rủi ro & Giải pháp

- **Rủi ro:** Khi sinh sheet `Processed v2` trên trình duyệt bằng ExcelJS, việc sao chép style, clone row và chèn Cell Note có thể gặp vấn đề về bộ nhớ nếu file rất lớn hoặc cú pháp cell note không tương thích browser.
- **Giải pháp:** Sử dụng giải pháp đã kiểm chứng từ `processedV2.ts` (clone row, gán note chuẩn ExcelJS, chỉ xử lý in-memory workbook), xử lý an toàn try/catch khi sao chép views/merges.
