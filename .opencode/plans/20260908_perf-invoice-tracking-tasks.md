# Performance Optimization Plan: Invoice Tracking (Theo dõi hóa đơn)
**Ngày:** 2026-09-08
**Feature:** Theo dõi hóa đơn (`/api/invoice-tracking`) trên cả Web App và Mobile

---

## ⚙️ BACKEND TASKS

| ID | Task | Chi tiết kỹ thuật | Effort |
|---|---|---|---|
| PERF-BE-01 | Loại bỏ `file_data` base64 trong list query | Trong `invoiceTrackingService.list`: chỉ select metadata của documents `(SELECT COALESCE(jsonb_agg(d - 'file_data'), '[]'::jsonb) FROM jsonb_array_elements(documents) d) AS documents` thay vì kéo toàn bộ Base64 hàng chục MB về Node.js. `getById` vẫn giữ đầy đủ `file_data`. | S |
| PERF-BE-02 | Thêm Index tối ưu truy vấn `dispatch_schedules` | Tạo migration thêm index: `idx_dispatch_schedules_list` trên `(invoice_status, created_at DESC)` và `(driver_id, invoice_status, created_at DESC)`. | XS |
| PERF-BE-03 | Sửa triệt để `pool.on('connect')` & tối ưu connection pool | Trong `backend/src/config/database.ts`: chuyển `SET timezone` sang connection parameters/options `options: '-c timezone=Asia/Ho_Chi_Minh'`, bật `keepAlive: true`, loại bỏ `client.query` bất đồng bộ trong event `connect`. | XS |
| PERF-BE-04 | Cache nhẹ dữ liệu phân quyền `dataScopeService` & `role.is_active` | Giảm bớt 3-4 câu query DB lặp lại trên mọi HTTP request trong middleware `auth.ts` và `dataScope.ts` bằng in-memory TTL cache (60s). | S |

## 🎨 FRONTEND & MOBILE TASKS

| ID | Task | Chi tiết kỹ thuật | Effort |
|---|---|---|---|
| PERF-FE-01 | Web: Lazy load chi tiết file chứng từ khi mở Modal | Trong `InvoiceTrackingPage.tsx` / `TicketDetailModal.tsx`: dùng `useInvoiceTrackingDetail(id)` để lấy đầy đủ chi tiết và dữ liệu file khi người dùng nhấn xem chi tiết. | S |
| PERF-MOB-01 | Mobile: Parse JSON siêu nhẹ & không decode base64 thừa | Mobile chỉ nhận danh sách metadata gọn nhẹ từ API list (vài KB thay vì hàng chục MB), decode tức thì không gây lag UI thread. | S |

## 📊 Thứ tự thực hiện
Phase 6: PERF-BE-01 → PERF-BE-02 → PERF-BE-03 → PERF-BE-04 → PERF-FE-01 → PERF-MOB-01
