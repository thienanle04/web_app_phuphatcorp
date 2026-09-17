# BA Analysis: Theo dõi hóa đơn (Invoice Tracking)

**Ngày:** 2026-08-31
**Feature:** Theo dõi hóa đơn — mở rộng từ Bảng điều phối xe
**Scope:** FULL (mở rộng table dispatch_schedules, thêm API endpoints mới, workflow đa role)

---

## 1. Mô tả yêu cầu

Hệ thống "Theo dõi hóa đơn" là phần mở rộng của chức năng "Bảng điều phối xe" (`dispatch_schedules`). Khi một chuyến xe được tạo mới ở Bảng điều phối xe, nó sẽ tự động xuất hiện trong module Theo dõi hóa đơn với trạng thái "Tạo mới". Tài xế upload hình chụp chứng từ, sau đó user có vai trò "Điều phối xe" duyệt hoặc yêu cầu bổ sung.

### Yêu cầu cốt lõi

1. **Không tạo table mới** — mở rộng table `dispatch_schedules` bằng cách thêm columns
2. **Chuẩn bị cho phân quyền tương lai** — thiết kế schema và API hỗ trợ lọc dữ liệu theo user/role
3. **Workflow trạng thái:** Tạo mới → Chờ duyệt → Hoàn thành / Yêu cầu bổ sung → (loop lại Chờ duyệt)

---

## 2. Data Model — Mở rộng `dispatch_schedules`

### Columns mới cần thêm

| Column | Type | Nullable | Default | Mô tả |
|--------|------|----------|---------|-------|
| `invoice_status` | VARCHAR(30) | NOT NULL | `'created'` | Trạng thái ticket: `created`, `pending_review`, `completed`, `request_supplement` |
| `driver_id` | INTEGER FK→users.id | YES | NULL | User ID của tài xế (để phân quyền tương lai) |
| `dispatcher_id` | INTEGER FK→users.id | YES | NULL | User ID của người điều phối đã duyệt/yêu cầu bổ sung |
| `documents` | JSONB | YES | `'[]'::jsonb` | Array chứa metadata chứng từ: `[{ file_name, mime_type, file_url, uploaded_at, note }]` |
| `supplement_note` | TEXT | YES | NULL | Ghi chú khi yêu cầu bổ sung (từ dispatcher) |
| `driver_note` | TEXT | YES | NULL | Ghi chú từ tài xế khi upload/bổ sung chứng từ |
| `reviewed_at` | TIMESTAMPTZ | YES | NULL | Thời điểm duyệt/yêu cầu bổ sung gần nhất |
| `completed_at` | TIMESTAMPTZ | YES | NULL | Thời điểm hoàn thành |

### State Machine

```
created ──[tài xế upload]──→ pending_review
    ↑                              │
    │                    ┌─────────┴─────────┐
    │                    │                   │
              [dispatcher: finish]   [dispatcher: update]
                    │                   │
                    ↓                   ↓
               completed        request_supplement
                                        │
                              [tài xế bổ sung]
                                        │
                                        ↓
                                 pending_review
```

### Giá trị enum `invoice_status`

| Value | Label (VI) | Mô tả |
|-------|-----------|-------|
| `created` | Tạo mới | Chuyến vừa được tạo ở Bảng điều phối xe, chưa có chứng từ |
| `pending_review` | Chờ duyệt | Tài xế đã upload chứng từ, chờ dispatcher duyệt |
| `completed` | Hoàn thành | Dispatcher xác nhận đủ chứng từ |
| `request_supplement` | Yêu cầu bổ sung | Dispatcher yêu cầu tài xế bổ sung chứng từ/ghi chú |

---

## 3. Use Cases

### UC-01: Tạo chuyến xe → Ticket tự động xuất hiện

**Actor:** User có quyền `dispatch.manage`
**Precondition:** User đang ở trang Bảng điều phối xe
**Flow:**
1. User tạo chuyến xe mới qua POST `/api/dispatch-schedules`
2. Backend tạo record với `invoice_status = 'created'`, `documents = '[]'`
3. Record xuất hiện trong danh sách Theo dõi hóa đơn

**Acceptance Criteria:**
- AC-01.1: Mọi chuyến xe tạo mới đều có `invoice_status = 'created'`
- AC-01.2: `documents` mặc định là mảng rỗng
- AC-01.3: `driver_id` được set nếu tài xế là user trong hệ thống (match theo tên hoặc chọn từ dropdown)

### UC-02: Tài xế upload chứng từ

**Actor:** Tài xế (user có role phù hợp, hoặc match `driver_id`)
**Precondition:** Ticket tồn tại và `invoice_status` ∈ {`created`, `request_supplement`}
**Flow:**
1. Tài xế vào trang Theo dõi hóa đơn, thấy ticket của mình
2. Click "Upload chứng từ" → mở modal/drawer
3. Chọn file ảnh (jpg/png/pdf), nhập ghi chú tùy chọn
4. Submit → backend lưu metadata vào `documents` array, set `invoice_status = 'pending_review'`
5. Toast success

**Acceptance Criteria:**
- AC-02.1: Chỉ upload được khi status ∈ {`created`, `request_supplement`}
- AC-02.2: Upload append vào mảng `documents` (không overwrite)
- AC-02.3: Sau upload, `invoice_status` tự động chuyển sang `pending_review`
- AC-02.4: `driver_note` được cập nhật nếu tài xế nhập ghi chú
- AC-02.5: File được lưu trữ (base64 hoặc presigned URL — TBD ở Tech Lead)
- AC-02.6: Validation: max 10 files, mỗi file ≤ 5MB, chỉ chấp nhận image/pdf

### UC-03: Dispatcher duyệt ticket (Finish)

**Actor:** User có quyền `dispatch.manage` (vai trò Điều phối xe)
**Precondition:** Ticket có `invoice_status = 'pending_review'`
**Flow:**
1. Dispatcher xem chi tiết ticket, kiểm tra documents
2. Click "Hoàn thành" → confirm dialog
3. Backend set `invoice_status = 'completed'`, `dispatcher_id`, `reviewed_at`, `completed_at`
4. Toast success, list refresh

**Acceptance Criteria:**
- AC-03.1: Chỉ finish được khi `invoice_status = 'pending_review'`
- AC-03.2: `dispatcher_id` = current user ID
- AC-03.3: `completed_at` = NOW()
- AC-03.4: Confirm dialog bắt buộc trước khi finish

### UC-04: Dispatcher yêu cầu bổ sung (Update)

**Actor:** User có quyền `dispatch.manage`
**Precondition:** Ticket có `invoice_status = 'pending_review'`
**Flow:**
1. Dispatcher xem chi tiết ticket
2. Click "Yêu cầu bổ sung" → mở dialog nhập ghi chú
3. Nhập `supplement_note` (bắt buộc)
4. Submit → backend set `invoice_status = 'request_supplement'`, `dispatcher_id`, `reviewed_at`, `supplement_note`
5. Toast success

**Acceptance Criteria:**
- AC-04.1: Chỉ request_supplement được khi `invoice_status = 'pending_review'`
- AC-04.2: `supplement_note` bắt buộc, min 5 ký tự
- AC-04.3: `dispatcher_id` và `reviewed_at` được cập nhật
- AC-04.4: Tài xế thấy `supplement_note` khi xem ticket

### UC-05: Tài xế bổ sung chứng từ sau yêu cầu

**Actor:** Tài xế
**Precondition:** Ticket có `invoice_status = 'request_supplement'`
**Flow:**
1. Tài xế thấy ticket với badge "Yêu cầu bổ sung" và ghi chú từ dispatcher
2. Upload thêm file mới và/hoặc cập nhật `driver_note`
3. Submit → backend append documents, set `invoice_status = 'pending_review'`
4. Toast success

**Acceptance Criteria:**
- AC-05.1: Documents mới được append, không xóa documents cũ
- AC-05.2: `driver_note` được cập nhật (overwrite hoặc append — khuyến nghị overwrite để giữ ghi chú mới nhất)
- AC-05.3: Status chuyển về `pending_review` sau bổ sung

### UC-06: Xem danh sách tickets

**Actor:** Bất kỳ authenticated user (với filter theo role trong tương lai)
**Flow:**
1. Vào trang Theo dõi hóa đơn
2. Thấy danh sách tickets với filters: status, date range, bien_so, tai_xe
3. Pagination, sort theo created_at DESC

**Acceptance Criteria:**
- AC-06.1: Filter theo `invoice_status` (multi-select)
- AC-06.2: Filter theo date range (ngay)
- AC-06.3: Search theo `bien_so`, `tai_xe`, `ma_chuyen`
- AC-06.4: Pagination mặc định 20/page
- AC-06.5: Sort mặc định: `created_at DESC`
- AC-06.6: Response include pagination metadata

### UC-07: Xem chi tiết ticket

**Actor:** Bất kỳ authenticated user liên quan
**Flow:**
1. Click vào ticket trong danh sách → mở detail view (modal hoặc page)
2. Hiển thị: thông tin chuyến xe, trạng thái, danh sách documents (preview ảnh), lịch sử actions, ghi chú

**Acceptance Criteria:**
- AC-07.1: Hiển thị đầy đủ thông tin dispatch_schedule gốc
- AC-07.2: Hiển thị tất cả documents với preview thumbnail
- AC-07.3: Hiển thị `supplement_note` nếu có
- AC-07.4: Hiển thị `driver_note` nếu có
- AC-07.5: Hiển thị lịch sử: ai upload, ai duyệt, timestamps

---

## 4. API Contract

### Endpoints mới

| Method | Path | Auth | Permission | Body/Query | Response |
|--------|------|------|------------|------------|----------|
| GET | /api/invoice-tracking | JWT | dispatch.view | query: `status`, `date_from`, `date_to`, `search`, `page`, `limit` | `{ success, data: DispatchSchedule[], pagination }` |
| GET | /api/invoice-tracking/:id | JWT | dispatch.view | — | `{ success, data: DispatchSchedule }` |
| POST | /api/invoice-tracking/:id/documents | JWT | — | multipart/form-data hoặc base64 JSON: `{ files: [{ file_name, mime_type, file_data, note? }] }` | `{ success, data: DispatchSchedule }` |
| PUT | /api/invoice-tracking/:id/review | JWT | dispatch.manage | `{ action: 'finish' \| 'request_supplement', supplement_note?: string }` | `{ success, data: DispatchSchedule }` |

### Notes

- **GET /api/invoice-tracking**: Reuse `dispatch_schedules` table, filter by `invoice_status IS NOT NULL`. Trong tương lai, thêm filter `driver_id = req.user.id` cho role tài xế.
- **POST documents**: Chấp nhận base64 JSON (giống pattern driver_documents). Max 10 files, 5MB/file.
- **PUT review**: Action `finish` → set completed; `request_supplement` → set request_supplement + require supplement_note.

### Backward Compatibility

- POST `/api/dispatch-schedules` (tạo chuyến) vẫn hoạt động bình thường, tự động set `invoice_status = 'created'`
- GET/PUT/DELETE `/api/dispatch-schedules` không bị ảnh hưởng
- Các columns mới đều nullable hoặc có default → migration an toàn

---

## 5. Phân quyền (chuẩn bị tương lai)

### Hiện tại

- Tất cả authenticated users có thể xem danh sách tickets
- `dispatch.manage` required cho finish/request_supplement
- Upload documents: bất kỳ authenticated user (sẽ restrict sau)

### Tương lai (khi có phân quyền)

| Role | View list | View detail | Upload docs | Finish | Request supplement |
|------|-----------|-------------|-------------|--------|--------------------|
| ADMIN | All | All | All | Yes | Yes |
| DISPATCHER (dispatch.manage) | All | All | All | Yes | Yes |
| DRIVER (driver_id match) | Own only | Own only | Own only | No | No |
| VIEWER | All | All | No | No | No |

**Thiết kế schema hỗ trợ:**
- `driver_id` column sẵn sàng cho row-level filtering
- `dispatcher_id` tracking ai đã action
- Permission codes: `invoice_tracking.view`, `invoice_tracking.upload`, `invoice_tracking.review` (có thể thêm sau)

---

## 6. Business Rules

- **BR-001:** `invoice_status` luôn được set khi tạo dispatch_schedule mới (default: `'created'`)
- **BR-002:** Upload documents chỉ allowed khi status ∈ {`created`, `request_supplement`}
- **BR-003:** Review (finish/request_supplement) chỉ allowed khi status = `pending_review`
- **BR-004:** `supplement_note` bắt buộc khi action = `request_supplement`
- **BR-005:** Documents là append-only (không xóa individual document qua API này)
- **BR-006:** Max 10 files per upload, mỗi file ≤ 5MB
- **BR-007:** Accepted MIME types: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`
- **BR-008:** `invoice_status` transitions enforced at service layer (state machine validation)
- **BR-009:** Migration phải idempotent (ALTER TABLE ADD COLUMN IF NOT EXISTS)
- **BR-010:** Backward compatible — existing dispatch_schedules records get `invoice_status = 'created'` via migration DEFAULT

---

## 7. Edge Cases

| Case | Handling |
|------|----------|
| Tạo chuyến nhưng không có tài xế | `driver_id = NULL`, ticket vẫn xuất hiện, upload bởi bất kỳ user nào |
| Upload khi status = `completed` | Reject 400: "Không thể upload khi ticket đã hoàn thành" |
| Finish khi status ≠ `pending_review` | Reject 400: "Chỉ có thể duyệt khi ticket ở trạng thái Chờ duyệt" |
| Request supplement mà không có supplement_note | Reject 400: "Ghi chú bổ sung là bắt buộc" |
| Upload file > 5MB | Reject 400: "File vượt quá kích thước tối đa 5MB" |
| Concurrent uploads | Append an toàn vì dùng JSONB array concat |
| Existing records trước migration | Migration set default `invoice_status = 'created'` cho tất cả rows hiện có |

---

## 8. UI/UX Requirements (tóm tắt)

### Screens

1. **Danh sách Theo dõi hóa đơn** (`/invoice-tracking`) — table với filters, badges trạng thái
2. **Chi tiết ticket** (modal hoặc drawer) — thông tin chuyến + documents + actions
3. **Upload chứng từ** (modal) — drag-drop/upload files + ghi chú
4. **Review dialog** (modal) — nút Finish + nút Yêu cầu bổ sung (với textarea)

### States

- Loading skeleton cho list và detail
- Empty state khi không có tickets
- Error state với nút "Thử lại"
- Badge colors: created=gray, pending_review=yellow, completed=green, request_supplement=red

### Validation UX

- Inline error dưới field ghi chú nếu trống
- Toast error khi upload fail
- Confirm dialog trước finish
- Disabled buttons khi submitting

---

## 9. Rủi ro & Lưu ý

| Risk | Mitigation |
|------|------------|
| File storage: base64 trong DB vs external storage | Dùng base64 JSONB (pattern giống driver_documents) cho MVP. Có thể migrate sang S3/presigned URL sau |
| Performance khi nhiều documents | Limit 10 files/ticket, paginate list endpoint |
| Phân quyền chưa implement | Schema sẵn sàng (driver_id, dispatcher_id). API check permission codes hiện tại (dispatch.view/manage) |
| Migration trên production | Idempotent migration, test trên staging trước |
| Backward compat | Default values cho columns mới, existing code không bị break |

</content>