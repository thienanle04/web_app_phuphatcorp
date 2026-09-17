# Task List: Sao chép chứng từ cùng ngày cho Mobile (Copy Documents Mobile)

**Ngày:** 2026-09-13  
**Brief:** `docs/light/20260913_mobile-copy-documents-brief.md`  

---

## 🎨 FRONTEND / MOBILE TASKS

| ID | Task | Chi tiết kỹ thuật | Effort |
|---|---|---|---|
| **L-01** | Core Endpoints & Data Models | Cập nhật `api_endpoints.dart` (3 endpoints copy/files). Cập nhật `DocumentFile` và thêm `CopyableTicket` trong `invoice_tracking_ticket.dart`. | S |
| **L-02** | Service & Provider Methods | Thêm `fetchCopyableTickets` và `copyDocuments` trong `invoice_tracking_service.dart` và `invoice_tracking_provider.dart`. | S |
| **L-03** | Copy Documents Modal UI | Tạo `lib/screens/invoice_tracking/dialogs/copy_documents_modal.dart` (Tìm kiếm xe cùng ngày, danh sách card xe có ảnh mẫu preview, radio chọn xe, ô ghi chú, nút submit). | M |
| **L-04** | Ticket Detail Integration | Cập nhật `ticket_detail_screen.dart` thêm nút "Sao chép chứng từ", gắn badge nguồn `🔗 Từ xe [Biển số]` trên thumbnail, hỗ trợ MinIO URL. | S |
| **L-05** | Document Viewer Update | Cập nhật `document_viewer_dialog.dart` hỗ trợ render cả `filename` (MinIO network image) và `file_data` (Base64). | S |
| **L-06** | Unit & Widget Tests | Viết test trong `test/copy_documents_test.dart`, chạy `flutter analyze` & `flutter test`. | S |

---

## 📊 Thứ tự thực hiện

Phase L3-L4: L-01 → L-02 → L-03 → L-04 → L-05 → L-06 → Update Lessons Learned
