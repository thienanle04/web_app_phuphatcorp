# BA Analysis: Cấu hình quy trình (Workflow Configuration)

**Ngày:** 2026-09-01
**Feature:** Cấu hình quy trình & Phân quyền thao tác theo bước (Workflow Engine & Dynamic Step Authorization)
**Scope:** FULL (Tables `workflows`, `workflow_steps`, `workflow_transitions`, API endpoints, UI Step Builder, tích hợp động với `invoice_tracking` và mở rộng cho tương lai)

---

## 1. Mô tả yêu cầu

Hệ thống cho phép cấu hình quy trình xử lý theo từng bước cho các chức năng trong web app PhuPhatCorp (khởi đầu áp dụng cho module **Theo dõi hóa đơn - `invoice_tracking`**, có thể bật/tắt và mở rộng cho các tính năng khác trong tương lai).

### Mục tiêu:
1. **Linh hoạt cấu hình (Workflow Engine):** Cho phép Quản trị viên (ADMIN) thêm mới, chỉnh sửa, xóa và thay đổi thứ tự các bước trong quy trình.
2. **Phân quyền thao tác theo bước (Step-based Authorization):**
   - Phân quyền theo Vai trò (Roles).
   - Phân quyền theo Người dùng cụ thể (Users).
   - Phân quyền theo Đối tượng động (Dynamic Actors: ví dụ *Tài xế của chuyến xe*, *Người tạo phiếu*, *Người điều phối*).
3. **Thực thi phân quyền thời gian thực:**
   - Backend chặn đứng các hành động trái phép dựa trên trạng thái ticket và cấu hình bước hiện tại.
   - Frontend ẩn/hiển thị các nút thao tác (`Upload chứng từ`, `Duyệt hoàn thành`, `Yêu cầu bổ sung`...) tương ứng với quyền của user tại bước đó.

---

## 2. Data Model

### Table `workflows`
| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | SERIAL PRIMARY KEY | NO | | ID quy trình |
| `feature_code` | VARCHAR(100) | NO | UNIQUE | Mã tính năng (vd: `invoice_tracking`) |
| `name` | VARCHAR(255) | NO | | Tên quy trình |
| `description` | TEXT | YES | NULL | Mô tả chi tiết |
| `module` | VARCHAR(50) | NO | `'dispatch'` | Phân hệ trực thuộc |
| `is_active` | BOOLEAN | NO | `TRUE` | Trạng thái bật/tắt áp dụng quy trình |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | |

### Table `workflow_steps`
| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | SERIAL PRIMARY KEY | NO | | ID bước |
| `workflow_id` | INTEGER | NO | FK->workflows | Liên kết quy trình |
| `step_order` | INTEGER | NO | `1` | Thứ tự bước |
| `step_code` | VARCHAR(50) | NO | | Mã bước (vd: `STEP_CREATED`) |
| `step_name` | VARCHAR(100) | NO | | Tên hiển thị bước |
| `status_code` | VARCHAR(50) | NO | | Trạng thái dữ liệu liên kết (`created`, `pending_review`, `completed`, `request_supplement`) |
| `allowed_actions` | VARCHAR(50)[] | NO | `'{}'` | Hành động cho phép (`upload_document`, `review_finish`, `request_supplement`) |
| `actor_type` | VARCHAR(20) | NO | `'role'` | `'role'`, `'user'`, `'dynamic'`, `'any'` |
| `assigned_role_ids` | INTEGER[] | YES | `'{}'` | Danh sách role_id được thao tác |
| `assigned_user_ids` | INTEGER[] | YES | `'{}'` | Danh sách user_id được thao tác |
| `dynamic_actor` | VARCHAR(50) | YES | NULL | `'assigned_driver'`, `'creator'`, `'dispatcher'` |
| `is_initial` | BOOLEAN | NO | `FALSE` | Đánh dấu bước khởi đầu |
| `is_final` | BOOLEAN | NO | `FALSE` | Đánh dấu bước kết thúc |

---

## 3. API Contract

| Method | Endpoint | Auth | Permission | Description |
|---|---|---|---|---|
| `GET` | `/api/workflows` | JWT | `workflows.view` | Lấy danh sách quy trình các tính năng |
| `GET` | `/api/workflows/:featureCode` | JWT | `workflows.view` | Lấy chi tiết quy trình, danh sách bước & luồng chuyển tiếp |
| `PATCH` | `/api/workflows/:featureCode/toggle` | JWT | `workflows.manage` | Bật/tắt áp dụng quy trình |
| `PUT` | `/api/workflows/:featureCode` | JWT | `workflows.manage` | Lưu toàn bộ cấu hình các bước & chuyển tiếp |

---

## 4. UI Specification

- **Màn hình Danh sách Quy trình (`/settings/workflows`):**
  - Hiển thị danh sách card tính năng, công tắc bật/tắt (Toggle On/Off), số lượng bước.
  - Nút "Cấu hình bước" mở modal Workflow Step Builder.
- **Modal Workflow Step Builder:**
  - Cột trái: Danh sách bước, nút thêm mới, đổi thứ tự (Up/Down), xóa bước.
  - Cột phải: Form biên tập bước (Tên bước, mã trạng thái, chọn Actor Type: Dynamic, Role, User, Any, chọn Allowed Actions).
