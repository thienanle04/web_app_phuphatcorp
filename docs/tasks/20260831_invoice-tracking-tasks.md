# Task List: Theo dõi hóa đơn (Invoice Tracking)
**Ngày:** 2026-08-31
**BA Doc:** docs/ba/20260831_invoice-tracking-analysis.md
**UI Spec:** docs/ui/20260831_invoice-tracking-ui-spec.md

---

## ⚙️ BACKEND TASKS

| ID   | Task | Chi tiết kỹ thuật | Effort |
|------|------|-------------------|--------|
| BE-01 | Migration 048 | `ALTER TABLE dispatch_schedules ADD COLUMN IF NOT EXISTS`: `invoice_status VARCHAR(30) DEFAULT 'created'`, `driver_id INTEGER FK→users.id`, `dispatcher_id INTEGER FK→users.id`, `documents JSONB DEFAULT '[]'::jsonb`, `supplement_note TEXT`, `driver_note TEXT`, `reviewed_at TIMESTAMPTZ`, `completed_at TIMESTAMPTZ`. Index: `idx_dispatch_invoice_status`, `idx_dispatch_driver_id` | S |
| BE-02 | Viết invoiceTrackingService | Methods: `list(filters, pagination)`, `getById(id)`, `uploadDocuments(id, files[], driverNote?)`, `review(id, action, supplementNote?, dispatcherId)`. State machine validation. Throw custom errors. Reuse pool from config/database.ts | M |
| BE-03 | Tạo API routes | `GET /api/invoice-tracking` (dispatch.view), `GET /api/invoice-tracking/:id` (dispatch.view), `POST /api/invoice-tracking/:id/documents` (authenticate), `PUT /api/invoice-tracking/:id/review` (dispatch.manage). Mount trong routes/index.ts | M |
| BE-04 | Zod validation schemas | `uploadDocumentsSchema`: body.files[] (max 10, mime check), body.driver_note optional. `reviewSchema`: body.action enum('finish','request_supplement'), body.supplement_note required when action=request_supplement | S |
| BE-05 | Cập nhật dispatchScheduleService.create | Set `invoice_status = 'created'` khi tạo chuyến mới. Backward compatible — existing POST /api/dispatch-schedules vẫn hoạt động | XS |

## 🎨 FRONTEND TASKS

| ID   | Task | Chi tiết kỹ thuật | Effort |
|------|------|-------------------|--------|
| FE-01 | React Query hooks | `useInvoiceTracking(filters)` → GET /api/invoice-tracking. `useInvoiceTrackingDetail(id)` → GET /:id. `useUploadDocuments()` → POST /:id/documents. `useReviewTicket()` → PUT /:id/review. File: `frontend/src/hooks/useInvoiceTracking.ts` | M |
| FE-02 | InvoiceTrackingPage | Route `/invoice-tracking`. Table với filters (status, search, date range), pagination, InvoiceStatusBadge. Skeleton loading, empty state, error state. File: `frontend/src/pages/invoice-tracking/InvoiceTrackingPage.tsx` | L |
| FE-03 | TicketDetailModal | Modal xl hiển thị thông tin chuyến, documents preview, actions conditional theo status + permission. File: `frontend/src/components/invoice-tracking/TicketDetailModal.tsx` | L |
| FE-04 | UploadDocumentsModal | Modal md với drag-drop zone, file list, ghi chú textarea. Validation client-side (size, type, count). File: `frontend/src/components/invoice-tracking/UploadDocumentsModal.tsx` | M |
| FE-05 | SupplementNoteDialog + ConfirmFinishDialog | Dialog sm cho yêu cầu bổ sung (textarea bắt buộc) và confirm finish. File: `frontend/src/components/invoice-tracking/SupplementNoteDialog.tsx`, `ConfirmFinishDialog.tsx` | S |
| FE-06 | InvoiceStatusBadge + DocumentPreview | Badge component map status→color. DocumentPreview render thumbnail image/pdf icon. File: `frontend/src/components/invoice-tracking/InvoiceStatusBadge.tsx`, `DocumentPreview.tsx` | S |
| FE-07 | i18n keys | Thêm ~50 keys vào vi.json và en.json theo UI Spec Section 5. Prefix: `invoice_tracking.*` | S |
| FE-08 | Router + Sidebar | Thêm route `/invoice-tracking` → InvoiceTrackingPage trong Router.tsx. Thêm nav item "Theo dõi hóa đơn" trong MainLayout sidebar (group Điều hành vận tải) | XS |

## 📊 Thứ tự thực hiện

Phase 3: BE-01 → BE-05 → BE-02 → BE-04 → BE-03
Phase 4: Run migration (`psql -f backend/src/migrations/048_add_invoice_tracking_to_dispatch_schedules.sql`)
Phase 5: Viết tests (test-qa skill)
Phase 6: Chạy tests (`cd backend && npm run test`)
Phase 7: FE-07 → FE-01 → FE-06 → FE-05 → FE-04 → FE-03 → FE-02 → FE-08
Phase 8: Regression (test-qa skill — đối chiếu UI Spec)

## Coding Standards
Đọc `.opencode/knowhow/coding_convention.md` trước khi viết bất kỳ dòng code nào.

## ⚠️ Lưu ý kỹ thuật
- Migration phải idempotent (ADD COLUMN IF NOT EXISTS) — chạy an toàn trên DB đã có dữ liệu
- `documents` JSONB lưu base64 string (pattern giống driver_documents) — max 5MB/file, 10 files/ticket
- State machine validation ở service layer: chỉ cho phép transition hợp lệ (created/request_supplement → pending_review via upload; pending_review → completed/request_supplement via review)
- `driver_id` column sẵn sàng cho row-level filtering tương lai nhưng chưa enforce ở phase này
- POST /api/dispatch-schedules (existing) cần set default `invoice_status = 'created'` — backward compatible
- Frontend đọc UI Spec trước khi code: `docs/ui/20260831_invoice-tracking-ui-spec.md`
- i18n: KHÔNG hardcode text, tất cả strings qua translation keys

</content>