# Brief: Sao chép chứng từ cùng ngày cho Theo dõi hóa đơn trên Mobile (Copy Documents)

**Ngày:** 2026-09-13  
**Feature:** Sao chép file đính kèm từ chuyến xe khác trong cùng ngày (Copy Documents for Same-Day Trips)  
**Nền tảng:** Flutter Mobile (`web_v2_mobile`)  
**Scope:** LIGHT (Tái sử dụng API Backend có sẵn, bổ sung modal chọn chuyến sao chép và cập nhật hiển thị chi tiết chuyến xe)

---

## 1. Tóm tắt yêu cầu nghiệp vụ

Trong thực tế vận hành giao nhận hàng của PhuPhatCorp:
* Nhiều xe (ví dụ 2-3 xe) cùng chạy vào **chung một kho / điểm giao nhận hàng** trong cùng một ngày.
* Thông thường chỉ có **1 tài xế ở lại nhận biên bản/chứng từ và chụp ảnh**. Các tài xế khác đi cùng chuyến chỉ cần **sao chép lại ảnh chứng từ** của xe đó thay vì phải chụp lại từ đầu.
* **Nguyên lý Zero-Duplication**: Backend API `/api/invoice-tracking/:id/copy-documents` không nhân bản file mà lưu liên kết tham chiếu (`filename` từ MinIO, `source_ticket_id`, `source_plate_number`).

---

## 2. Các tệp tin ảnh hưởng trên Mobile

1. **`lib/core/api/api_endpoints.dart`**:
   * Thêm `invoiceTrackingCopyableTickets(id)`, `invoiceTrackingCopyDocuments(id)`, `invoiceTrackingFile(filename)`.
2. **`lib/data/models/invoice_tracking_ticket.dart`**:
   * Cập nhật `DocumentFile` hỗ trợ `filename`, `source_ticket_id`, `source_plate_number`.
   * Thêm model `CopyableTicket`.
3. **`lib/data/services/invoice_tracking_service.dart`**:
   * Thêm phương thức `fetchCopyableTickets(ticketId)` và `copyDocuments(...)`.
4. **`lib/providers/invoice_tracking_provider.dart`**:
   * Thêm `fetchCopyableTickets` và `copyDocuments`.
5. **`lib/screens/invoice_tracking/dialogs/copy_documents_modal.dart` (MỚI)**:
   * Modal BottomSheet / Dialog hiển thị danh sách các chuyến xe cùng ngày đã có chứng từ.
   * Tìm kiếm theo biển số, tài xế, điểm giao.
   * Xem trước thumbnail ảnh của chuyến mẫu, nhập ghi chú tài xế, bấm "Xác nhận sao chép".
6. **`lib/screens/invoice_tracking/ticket_detail_screen.dart`**:
   * Bổ sung nút **"Sao chép chứng từ"** (icon Copy) cạnh nút "Tải lên chứng từ".
   * Hiển thị badge nhỏ `🔗 [Biển số xe gốc]` trên ảnh đã sao chép.
   * Hỗ trợ load ảnh từ MinIO URL hoặc Base64.
7. **`lib/screens/invoice_tracking/dialogs/document_viewer_dialog.dart`**:
   * Hỗ trợ render ảnh từ URL MinIO (`Image.network`) và Base64 (`Image.memory`).

---

## 3. Rủi ro & Giải pháp

| Rủi ro | Giải pháp |
|---|---|
| Chuyến xe gốc bị xóa hoặc sửa | Backend đã thiết kế liên kết độc lập — ảnh của chuyến sao chép vẫn hiển thị bình thường. |
| Mạng yếu khi load thumbnail | Dùng `Image.network` có `loadingBuilder` và `errorBuilder` mượt mà. |
| Tương thích ngược | Hỗ trợ cả file cũ lưu bằng Base64 `file_data` và file mới lưu bằng MinIO `filename`. |
