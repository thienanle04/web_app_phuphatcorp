# BA Analysis: Tab Thống kê Theo dõi hóa đơn (Invoice Tracking Statistics)

**Ngày:** 2026-09-02  
**Feature:** Bổ sung Tab "Thống kê" cho tính năng Theo dõi hóa đơn  
**Module:** `invoice_tracking` (`dispatch`)  
**Scope:** FULL

---

## 1. Mô tả yêu cầu

Bổ sung thêm tab **"Thống kê"** (`Statistics`) bên cạnh tab **"Danh sách ticket"** trong chức năng Theo dõi hóa đơn (`/invoice-tracking`).
Mục tiêu:
- Cho phép người dùng xem thống kê số lượng ticket của **từng tài xế** tương ứng với từng trạng thái:
  1. `created` (Tạo mới / Chưa nộp chứng từ)
  2. `pending_review` (Chờ duyệt)
  3. `request_supplement` (Yêu cầu bổ sung)
  4. `completed` (Hoàn thành)
  5. `total` (Tổng số ticket)
- Cho phép lọc động theo:
  - **Biển số xe** (`bien_so`)
  - **Tài xế** (`tai_xe` / `driver_id`)
  - **Khoảng thời gian** (`date_from` - `date_to` theo ngày chuyến `ngay`)
- Tích hợp chặt chẽ với phân quyền dữ liệu (**Data Scope**): Tài xế chỉ xem được thống kê của chính mình (`owner`), quản lý / kế toán xem theo phạm vi được phân quyền (`all` / `entity`).

---

## 2. Business Rules & Logic

- **BR-001 (Data Source):** Dữ liệu thống kê được tính toán trực tiếp từ bảng `dispatch_schedules` (với điều kiện `invoice_status IS NOT NULL`).
- **BR-002 (Grouping):** Nhóm theo Tài xế (`tai_xe` / `driver_id`). Nếu có chuyến chưa gán tài xế, nhóm dưới nhãn "Chưa phân công" (`Chưa gán tài xế`).
- **BR-003 (KPI Cards):** Hiển thị hàng tổng quan KPI toàn hệ thống / theo bộ lọc:
  - Tổng số chuyến / tickets
  - Số ticket Tạo mới (`created`)
  - Số ticket Chờ duyệt (`pending_review`)
  - Số ticket Yêu cầu bổ sung (`request_supplement`)
  - Số ticket Hoàn thành (`completed`)
  - Tỷ lệ hoàn thành (%)
- **BR-004 (Data Scope Enforcement):** Middleware `resolveDataScope('invoice_tracking')` tự động áp dụng:
  - Scope `none`: Trả về mảng rỗng và tổng số bằng 0.
  - Scope `owner`: Lọc `(driver_id = user.userId OR (driver_id IS NULL AND created_by = user.userId))`.
  - Scope `entity`: Lọc theo danh sách `vehicle_id` hoặc `driver_id` được gán.
  - Scope `all`: Xem toàn bộ.
- **BR-005 (Filtering):**
  - `date_from`: `ngay >= $date_from`
  - `date_to`: `ngay <= $date_to`
  - `bien_so`: `bien_so ILIKE $bien_so`
  - `driver_id` hoặc `tai_xe`: Khớp tài xế cụ thể.

---

## 3. Use Cases

### UC-01: Xem tổng quan thống kê theo tài xế
- **Actor:** Người dùng có quyền `invoice_tracking.view` (Điều phối, Kế toán, Admin, Tài xế).
- **Flow:**
  1. Người dùng vào `/invoice-tracking`.
  2. Bấm vào tab "Thống kê".
  3. Hệ thống hiển thị:
     - 4 thẻ KPI tóm tắt (Tổng số, Chờ duyệt, Yêu cầu bổ sung, Hoàn thành).
     - Bảng chi tiết: STT | Tên tài xế | Biển số xe phụ trách | Tạo mới | Chờ duyệt | Yêu cầu bổ sung | Hoàn thành | Tổng cộng | Tỷ lệ hoàn thành.
- **Acceptance Criteria:**
  - AC-01.1: Hiển thị đúng số liệu thống kê tổng và chi tiết từng dòng.
  - AC-01.2: Dòng tổng cộng (Footer) hiển thị tổng của toàn bộ bảng.

### UC-02: Lọc thống kê theo khoảng thời gian và phương tiện
- **Actor:** Người dùng có quyền `invoice_tracking.view`.
- **Flow:**
  1. Chọn khoảng ngày `date_from` và `date_to`.
  2. Chọn/nhập biển số xe hoặc tên tài xế.
  3. Bấm Lọc (hoặc debounce tự động).
  4. Hệ thống cập nhật bảng thống kê và các thẻ KPI tương ứng.
- **Acceptance Criteria:**
  - AC-02.1: Bộ lọc áp dụng chính xác cho cả các thẻ KPI và bảng chi tiết.

---

## 4. API Contract

### Endpoint: `GET /api/invoice-tracking/statistics`
- **Permission:** `invoice_tracking.view` (JWT)
- **Query Params:**
  - `date_from?: string` (YYYY-MM-DD)
  - `date_to?: string` (YYYY-MM-DD)
  - `bien_so?: string`
  - `driver_id?: number`
  - `tai_xe?: string`
- **Response Format:**
```json
{
  "success": true,
  "message": "Thống kê theo dõi hóa đơn",
  "data": {
    "summary": {
      "total_tickets": 120,
      "created_count": 15,
      "pending_review_count": 25,
      "request_supplement_count": 8,
      "completed_count": 72,
      "completion_rate": 60.0
    },
    "by_driver": [
      {
        "driver_id": 12,
        "driver_name": "Nguyễn Văn A",
        "vehicles": ["51C-123.45", "51C-678.90"],
        "created_count": 2,
        "pending_review_count": 5,
        "request_supplement_count": 1,
        "completed_count": 20,
        "total_tickets": 28,
        "completion_rate": 71.4
      }
    ]
  }
}
```
