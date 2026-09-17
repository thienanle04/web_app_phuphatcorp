# Task List: Tab Thống kê Theo dõi hóa đơn (Invoice Tracking Statistics)

**Ngày:** 2026-09-02  
**BA Doc:** `docs/ba/20260902_invoice-tracking-statistics-analysis.md`  
**UI Spec:** `docs/ui/20260902_invoice-tracking-statistics-ui-spec.md`  

---

## ⚙️ BACKEND TASKS

| ID | Task | Chi tiết kỹ thuật | Effort |
|---|---|---|---|
| BE-01 | Viết Service Method `getStatistics` | File: `backend/src/services/invoiceTrackingService.ts`<br>- Query SQL tổng hợp `COUNT(*) FILTER (WHERE invoice_status = ...)` nhóm theo `COALESCE(u.full_name, ds.tai_xe, 'Chưa gán')`<br>- Lọc theo `date_from`, `date_to`, `bien_so`, `driver_id`, `tai_xe`<br>- Tích hợp `DataScope` (`all`, `owner`, `entity`, `none`) | M |
| BE-02 | Validation Schema `invoiceTrackingStatisticsSchema` | File: `backend/src/controllers/invoiceTrackingController.ts`<br>- Validate query: `date_from` (YYYY-MM-DD), `date_to` (YYYY-MM-DD), `bien_so`, `driver_id`, `tai_xe` | S |
| BE-03 | Tạo API Controller & Route Endpoint | File: `backend/src/controllers/invoiceTrackingController.ts` & `backend/src/routes/invoiceTracking.ts`<br>- `GET /api/invoice-tracking/statistics`<br>- Middleware: `authenticateToken` -> `resolveDataScope('invoice_tracking')` -> `requirePermission('invoice_tracking.view')` | S |

## 🎨 FRONTEND TASKS

| ID | Task | Chi tiết kỹ thuật | Effort |
|---|---|---|---|
| FE-01 | API Client & React Query Hook | File: `frontend/src/api/invoiceTrackingApi.ts` & `frontend/src/hooks/useInvoiceTracking.ts`<br>- Interfaces: `InvoiceTrackingStatisticsSummary`, `DriverInvoiceStatistics`, `InvoiceTrackingStatisticsResponse`<br>- Hook: `useInvoiceTrackingStatistics(filters)` | S |
| FE-02 | i18n Translation Keys | File: `frontend/src/i18n/vi.json` & `en.json`<br>- Bổ sung keys cho Tab Thống kê, KPI labels, Table columns, Filters | S |
| FE-03 | Tạo Component `InvoiceTrackingStatsTab` | File: `frontend/src/components/invoice-tracking/InvoiceTrackingStatsTab.tsx`<br>- Thanh bộ lọc: Ngày từ - đến, Biển số xe, Tài xế, Xóa lọc<br>- 5 Thẻ KPI Card tóm tắt: Tổng số, Tạo mới, Chờ duyệt, Yêu cầu bổ sung, Hoàn thành, Tỷ lệ hoàn thành<br>- Bảng phân tích chi tiết theo từng tài xế (Danh sách xe, số lượng theo từng status, Tỷ lệ HT, Dòng tổng cộng) | M |
| FE-04 | Tích hợp Tab Switcher vào `InvoiceTrackingPage` | File: `frontend/src/pages/invoice-tracking/InvoiceTrackingPage.tsx`<br>- Tab navigation: "Danh sách ticket" (Icon `List`) & "Thống kê" (Icon `BarChart3`) | S |

## 📊 Thứ tự thực hiện

- Phase 3: BE-01 → BE-02 → BE-03
- Phase 4: Verification backend (`npm run build`, `npm run test`)
- Phase 7: FE-01 → FE-02 → FE-03 → FE-04
- Phase 8: Verification frontend (`npm run build`)

## ⚠️ Lưu ý kỹ thuật
- Tận dụng hiệu quả SQL aggregate function (`COUNT(*) FILTER (WHERE ...)` và `array_agg(DISTINCT bien_so)`) để gom thống kê trong 1 query duy nhất, tránh N+1.
- Áp dụng triệt để data scope: Tài xế chỉ xem được KPI của chính mình; Quản lý/Kế toán xem toàn bộ hoặc theo entity được cấp quyền.
- Hỗ trợ responsive tốt trên mobile: Các thẻ KPI co giãn dạng grid (2 cột trên mobile, 5 cột trên desktop), bảng thống kê cuộn ngang mượt mà.
