# BA Analysis: Điều hành vận tải (Dispatch Schedule) trên Mobile App

**Ngày:** 2026-09-11  
**Feature:** Bảng điều phối xe / Điều hành vận tải trên ứng dụng Flutter Mobile (`web_v2_mobile`)  
**Scope:** FULL (Màn hình điều phối theo ngày với 3 Tabs: Xe nhỏ, Xe lớn, Lịch ngoài tuyến; Form tạo chuyến xe; Form chỉnh sửa chuyến xe; Xác nhận xóa chuyến)

---

## 1. Mục tiêu & Mô tả yêu cầu

Chuyển đổi toàn bộ giao diện và chức năng của module **"Điều hành vận tải" (`/dispatch/schedule`)** từ Web App sang Mobile Flutter App (`web_v2_mobile`) nhằm phục vụ nhân viên điều hành, quản lý và tài xế có thể tra cứu và thao tác nhanh trên điện thoại di động mọi lúc mọi nơi.

### Yêu cầu cốt lõi:
1. **Dùng chung 100% Backend API hiện hữu**: Kết nối trực tiếp vào `/api/dispatch-schedules` (không sửa đổi database schema hay API contract).
2. **Bộ lọc theo ngày (`date`)**: Mặc định hiển thị ngày hiện tại (Hôm nay), hỗ trợ chuyển ngày bằng DatePicker hoặc 2 nút chuyển Ngày trước / Ngày sau.
3. **Phân loại hiển thị theo 3 Tabs**:
   - **Tab 1: Xe nhỏ** (`loai_tuyen = 'Tuyến cố định'` & `loai_xe = 'Xe nhỏ'`)
   - **Tab 2: Xe lớn** (`loai_tuyen = 'Tuyến cố định'` & `loai_xe = 'Xe lớn'`)
   - **Tab 3: Lịch ngoài tuyến** (`loai_tuyen = 'Tuyến ngoài'`)
4. **Hành động nghiệp vụ trên Mobile**:
   - **Xem danh sách chuyến**: Card hiển thị trực quan thông tin biển số, tài xế, điểm nhận hàng, số tấn, CAN, ghi chú.
   - **Tạo chuyến xe mới (`POST /api/dispatch-schedules`)**: Wizard/Form chọn Loại tuyến, Cỡ xe, chọn Biển số xe (tự động điền Tài xế), nhập Điểm nhận, Số tấn, CAN, Ghi chú.
   - **Chỉnh sửa chuyến xe (`PUT /api/dispatch-schedules/:id`)**: Cập nhật điểm nhận, số tấn, CAN, ghi chú.
   - **Xóa chuyến xe (`DELETE /api/dispatch-schedules/:id`)**: Xác nhận xóa có cảnh báo trước khi xóa.
5. **Phân quyền truy cập**:
   - Chỉ người dùng có quyền `dispatch.view` (hoặc `ADMIN`) mới thấy Tab "Điều phối xe" trên thanh điều hướng `BottomNavigationBar`.
   - Chỉ người dùng có quyền `dispatch.manage` (hoặc `ADMIN`) mới thấy các nút Tạo chuyến, Sửa chuyến, Xóa chuyến.

---

## 2. Use Cases & User Flows

### UC-01: Tra cứu lịch điều phối theo ngày
- **Actor:** Người dùng có quyền `dispatch.view` (hoặc `ADMIN`).
- **Flow:**
  1. Người dùng chọn tab "Điều phối" trên BottomNavigationBar.
  2. Màn hình tự động tải danh sách chuyến xe của ngày hôm nay (`date=YYYY-MM-DD`).
  3. Người dùng chuyển đổi giữa 3 tabs: **Xe nhỏ**, **Xe lớn**, **Lịch ngoài tuyến** để xem danh sách chuyến tương ứng.
  4. Người dùng có thể bấm DatePicker hoặc nút Mũi tên để xem lịch của ngày khác.
  5. Kéo màn hình xuống (Pull-to-refresh) để làm mới dữ liệu.

### UC-02: Tạo chuyến xe điều phối mới
- **Actor:** Người dùng có quyền `dispatch.manage` (hoặc `ADMIN`).
- **Flow:**
  1. Người dùng bấm nút Floating Action Button (+) hoặc nút "Thêm chuyến" trong Tab.
  2. Mở màn hình/Modal "Tạo chuyến xe mới".
  3. Chọn Loại tuyến (Tuyến cố định / Tuyến ngoài).
  4. Chọn Cỡ xe (Xe nhỏ / Xe lớn).
  5. Chọn Biển số xe từ danh sách xe hoạt động (Hệ thống tự động tra cứu và hiển thị tên Tài xế được gán).
  6. Nhập Điểm nhận hàng (bắt buộc), Số tấn (tùy chọn), CAN (tùy chọn), Ghi chú (tùy chọn).
  7. Bấm "Xác nhận tạo chuyến" -> Gửi `POST /api/dispatch-schedules`.
  8. Thông báo thành công và tự động làm mới danh sách chuyến của ngày đó.

### UC-03: Chỉnh sửa thông tin chuyến xe
- **Actor:** Người dùng có quyền `dispatch.manage` (hoặc `ADMIN`).
- **Flow:**
  1. Trên thẻ chuyến xe, người dùng bấm icon Sửa (✏️).
  2. Mở modal chỉnh sửa (Biển số, loại tuyến, cỡ xe bị khóa chỉ đọc).
  3. Người dùng cập nhật Điểm nhận, Số tấn, CAN, Ghi chú.
  4. Bấm "Lưu thay đổi" -> Gửi `PUT /api/dispatch-schedules/:id`.
  5. Thông báo thành công và cập nhật lại thẻ chuyến xe.

### UC-04: Xóa chuyến xe
- **Actor:** Người dùng có quyền `dispatch.manage` (hoặc `ADMIN`).
- **Flow:**
  1. Người dùng bấm icon Xóa (🗑️) trên thẻ chuyến xe.
  2. Hiển thị hộp thoại cảnh báo xác nhận xóa (`DeleteConfirmDialog`).
  3. Người dùng bấm "Xóa" -> Gửi `DELETE /api/dispatch-schedules/:id`.
  4. Thông báo thành công và xóa chuyến xe khỏi danh sách.

---

## 3. Acceptance Criteria

- **AC-01:** Phân chia chính xác chuyến xe vào 3 Tab dựa trên `loai_tuyen` và `loai_xe`.
- **AC-02:** Badge đếm số lượng chuyến xe trên mỗi Tab cập nhật theo thời gian thực tương ứng với ngày đang chọn.
- **AC-03:** Hỗ trợ bộ chọn ngày linh hoạt (DatePicker + nút Hôm nay + nút Tiến/Lùi ngày).
- **AC-04:** Form tạo chuyến bắt buộc phải có Điểm nhận hàng và Biển số xe; tự động gán đúng `driver_id` và `tai_xe`.
- **AC-05:** Người dùng không có quyền `dispatch.manage` không thấy nút Tạo chuyến, icon Sửa, icon Xóa.
- **AC-06:** Hỗ trợ đầy đủ Light & Dark Theme theo hệ thống màu chuẩn của PhuPhatCorp.
- **AC-07:** Kiểm thử tự động `flutter analyze` và `flutter test` đạt 100% pass.
