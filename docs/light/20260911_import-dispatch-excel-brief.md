# Brief: Import Excel cho Bảng điều phối xe (Dispatch Schedule)
**Ngày:** 2026-09-11
**Loại:** LIGHT
**Feature:** Bảng điều phối xe (`/dispatch/schedule`)

---

## 1. Tóm tắt yêu cầu

Bổ sung chức năng **Import Excel** cho từng tab trong Bảng điều phối xe (**Xe nhỏ**, **Xe lớn**, **Lịch ngoài tuyến**) theo cấu trúc file mẫu `reference/bang_dieu_phoi/test_xe_nho_100926.xlsx`.

### Quy tắc nghiệp vụ (Business Rules)
1. **Context theo Tab & Ngày:**
   - **Tab Xe nhỏ:** Import tạo các chuyến với `loai_tuyen = 'Tuyến cố định'`, `loai_xe = 'Xe nhỏ'`.
   - **Tab Xe lớn:** Import tạo các chuyến với `loai_tuyen = 'Tuyến cố định'`, `loai_xe = 'Xe lớn'`.
   - **Tab Tuyến ngoài:** Import tạo các chuyến với `loai_tuyen = 'Tuyến ngoài'`, cho phép chọn loại xe (`Xe nhỏ` / `Xe lớn`) hoặc mặc định `Xe nhỏ`.
   - **Ngày:** Áp dụng `selectedDate` hiện tại trên SchedulePage.

2. **Cấu trúc cột Excel (Sheet1 / bất kỳ sheet đầu tiên):**
   - Hàng tiêu đề nhận diện các cột: `STT`, `NƠI GIAO`, `TẤN`, `SỐ XE`, `CAN`, `GHI CHÚ`.
   - **NƠI GIAO** → `diem_nhan` (Điểm nhận / giao hàng).
   - **TẤN** → `tan` (Chuỗi trọng lượng, e.g. "1,7", "2,0").
   - **SỐ XE** → `bien_so` (**BẮT BUỘC**). Nếu dòng nào không có biển số xe → đánh dấu lỗi không hợp lệ.
   - **CAN** → `can` (Mã cân / CAN, e.g. "MCC", hoặc null).
   - **GHI CHÚ** → `ghi_chu` (Ghi chú chuyến xe, e.g. "XUẤT KHO UNI", hoặc null).

3. **Nhận diện xe & Tài xế từ Danh mục xe (`vehicles`):**
   - Biển số xe được chuẩn hóa (loại bỏ khoảng trắng thừa, ký tự ẩn).
   - Tra cứu trong danh mục `vehicles` (đã nạp sẵn trong cache / catalog API):
     - Nếu tìm thấy xe trong danh mục → gán `vehicle_id`, tự động điền `tai_xe = driver_name`, gán `xe_type = 'Xe nhà'`.
     - Nếu không tìm thấy trong danh mục → `vehicle_id = null`, `tai_xe = null`, `xe_type = 'Xe ngoài'`.

4. **Giao diện & Trải nghiệm (UX):**
   - Thêm nút "Import Excel" ở thanh công cụ / header của từng bảng `ScheduleTable` và `OutsideRouteTable` (bên cạnh nút "Thêm chuyến").
   - Mở modal `ImportDispatchExcelModal`:
     - Kéo thả / Chọn file `.xlsx`.
     - Preview danh sách các dòng đọc được trước khi lưu (Biển số, Điểm nhận, Tấn, CAN, Ghi chú, Tài xế tự nhận diện).
     - Báo lỗi rõ ràng nếu có dòng thiếu biển số hoặc file không đúng định dạng.
     - Nút "Xác nhận Import" thực hiện lưu hàng loạt qua `useBatchCreateDispatchSchedule()`.
     - Đóng modal, hiển thị Toast thành công và tự động làm mới danh sách chuyến của ngày đó.

---

## 2. Files ảnh hưởng

| File | Loại thay đổi | Chi tiết |
|------|---------------|----------|
| `frontend/src/components/dispatch/ImportDispatchExcelModal.tsx` | Tạo mới | Modal import Excel, kéo thả file, parse xlsx, preview bảng dữ liệu, validate bắt buộc biển số xe, hiển thị lỗi |
| `frontend/src/components/dispatch/ScheduleTable.tsx` | Cập nhật | Thêm prop `onImport?: () => void`, nút "Import Excel" trên header |
| `frontend/src/components/dispatch/OutsideRouteTable.tsx` | Cập nhật | Thêm prop `onImport?: () => void`, nút "Import Excel" trên header |
| `frontend/src/pages/dispatch/SchedulePage.tsx` | Cập nhật | State mở modal import, handler import cho từng tab, tích hợp `ImportDispatchExcelModal` |
| `frontend/src/i18n/vi.json` & `en.json` | Cập nhật | Thêm các i18n keys cho chức năng import Excel bảng điều phối |

---

## 3. Backend & API

- Đã có sẵn endpoint batch insert `POST /api/dispatch-schedules/batch` và hook `useBatchCreateDispatchSchedule()` hỗ trợ chèn mảng `CreateDispatchScheduleBatchItem[]`.
- Không cần sửa backend hay database migration.

---

## 4. Rủi ro & Giải pháp

- **Rủi ro:** Ký tự ẩn hoặc dấu cách lạ trong biển số xe Excel (ví dụ `50H 63174\u00a0`).
  - **Giải pháp:** Viết hàm clean & normalize biển số xe chuẩn hóa regex `\s+` và `\u00a0`.
- **Rủi ro:** Định dạng cột Tấn có thể là số (1.7) hoặc chuỗi ("1,7").
  - **Giải pháp:** Chuyển đổi an toàn sang string giữ nguyên giá trị người dùng nhập.
