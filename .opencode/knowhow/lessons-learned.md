---
description: Ghi lại các bài học kinh nghiệm, bug đã fix, và pitfalls trong quá trình phát triển PhuPhatCorp.
---

# Lessons Learned — PhuPhatCorp

---
## Change: Đổi ô nhập "Điểm nhận hàng" sang Text Input tự do trong Tạo/Sửa chuyến xe
- **Ngày:** 2026-10-02
- **Feature:** Bảng điều phối xe (`CreateScheduleModal.tsx`, `EditScheduleModal.tsx`)
- **Mô tả:** Chuyển trường nhập liệu "Điểm nhận hàng" (`diem_nhan`) từ `SearchableSelect` (chọn từ danh mục điểm nhận hàng) thành ô nhập văn bản tự do (`<input type="text" ...>`) ở cả giao diện tạo mới chuyến (mobile + desktop) và modal sửa chuyến xe, tạo sự linh hoạt tối đa khi nhập điểm giao nhận thực tế.
- **Files liên quan:** `frontend/src/components/dispatch/CreateScheduleModal.tsx`, `frontend/src/components/dispatch/EditScheduleModal.tsx`, `frontend/src/i18n/vi.json`, `frontend/src/i18n/en.json`.

---
## Feature: Quick Approval Tab & Batch Finish for Invoice Tracking
- **Ngày:** 2026-10-02
- **Feature:** Theo dõi hóa đơn (`invoice_tracking`), Phê duyệt nhanh & Batch Approve
- **Mô tả:** Bổ sung tab làm việc "Phê duyệt nhanh" tập trung toàn bộ các chuyến xe ở trạng thái `pending_review`, hỗ trợ phê duyệt 1-click tại dòng hoặc tick chọn hàng loạt để duyệt "Hoàn thành" cùng lúc.
- **Giải pháp:**
  - **Backend**: Thêm endpoint `POST /api/invoice-tracking/batch-finish` nhận danh sách `ticket_ids`, kiểm tra quyền workflow `review_finish` & Data Scope, cập nhật trạng thái đồng loạt sang `completed` và ghi nhận `audit_logs` đầy đủ.
  - **Frontend**:
    - `InvoiceTrackingQuickApprovalTab`: Bộ lọc tìm kiếm & khoảng ngày, checkbox chọn tất cả / từng dòng, thanh công cụ nổi (Selection Action Bar) hiển thị số lượng chọn và nút duyệt hàng loạt.
    - `BatchApproveConfirmDialog`: Hộp thoại xác nhận trước khi thực thi duyệt hàng loạt.
    - Cột thao tác cung cấp nút Duyệt 1-click, Yêu cầu bổ sung nhanh (`SupplementNoteDialog`) và Xem chi tiết (`TicketDetailModal`).
    - Tab Switcher trên `InvoiceTrackingPage` tích hợp huy hiệu đếm số lượng chuyến xe đang chờ duyệt (`pending_review`).
- **Files liên quan:** `invoiceTrackingService.ts`, `invoiceTrackingController.ts`, `routes/invoiceTracking.ts`, `invoiceTrackingApi.ts`, `useInvoiceTracking.ts`, `InvoiceTrackingQuickApprovalTab.tsx`, `BatchApproveConfirmDialog.tsx`, `InvoiceTrackingPage.tsx`, `vi.json`, `en.json`.

---
## Feature: Image Rotation Control in DocumentViewerModal
- **Ngày:** 2026-10-02
- **Feature:** Theo dõi hóa đơn (`DocumentViewerModal`, Lightbox Image Viewer)
- **Mô tả:** Hỗ trợ xoay hình ảnh $90^\circ, 180^\circ, 270^\circ, 0^\circ$ trực tiếp trên modal xem ảnh chi tiết giúp giải quyết việc ảnh hóa đơn tài xế chụp dọc/ngược khó đọc trên màn hình máy tính.
- **Thực hiện:**
  - `DocumentViewerModal.tsx`:
    - Thêm các nút xoay: `RotateCcw` (Xoay trái $90^\circ$), `RotateCw` (Xoay phải $90^\circ$) và nút huy hiệu hiển thị góc xoay (ví dụ `90°`) để đặt lại về ban đầu ($0^\circ$).
    - Hỗ trợ phím tắt bàn phím: Phím `R` / `r` để xoay phải, phím `L` / `l` để xoay trái.
    - Tự động đặt lại góc xoay về $0^\circ$ khi chuyển qua ảnh khác (Next/Back) hoặc đổi tệp.
    - Hiệu ứng chuyển động mượt mà với CSS transition `transition-transform duration-200 ease-in-out`.
    - Tự động ẩn các nút xoay khi tệp đang xem là tài liệu PDF.
- **Files:** `frontend/src/components/invoice-tracking/DocumentViewerModal.tsx`, `frontend/src/i18n/vi.json`, `frontend/src/i18n/en.json`.

---
## Rule: Kiểm tra & Tự động bỏ qua chuyến xe trùng lặp khi Import nhiều lần trong ngày
- **Ngày:** 2026-09-30
- **Severity:** Medium
- **Feature liên quan:** Bảng điều phối xe (`dispatchScheduleService` & `ImportDispatchExcelModal`)
- **Mô tả:** Khi người điều phối import file Excel nhiều lần trong 1 ngày, hệ thống đối soát từng chuyến theo composite key toàn bộ thông tin: `ngày` + `loại tuyến` + `cỡ xe` + `biển số chuẩn hóa` + `điểm nhận` + `tấn` + `CAN` + `ghi chú`.
- **Thực hiện:**
  - **Frontend (`ImportDispatchExcelModal.tsx`)**: Đối soát dữ liệu đọc được từ Excel với danh sách chuyến xe đã ghi nhận trong ngày (`existingSchedules`) và các dòng trùng lặp nội bộ trong file. Đánh dấu trạng thái màu cam `"Đã tồn tại trên hệ thống (Sẽ bỏ qua)"` / `"Trùng lặp trong file (Sẽ bỏ qua)"`, hiển thị badge thống kê số chuyến mới và số chuyến trùng. Nút bấm xác nhận hiển thị rõ: `Xác nhận Import (X chuyến mới) — Bỏ qua Y trùng`.
  - **Backend (`dispatchScheduleService.ts`)**: Trong `createBatch`, truy vấn trước các bản ghi trong ngày (`ngay = ANY($1)`) và duy trì `Set` các key đã tồn tại + `Set` các key trong batch để bỏ qua việc `INSERT` chuyến trùng lặp, đảm bảo an toàn dữ liệu và không tạo thừa ticket cho tài xế.
- **Files:** `backend/src/services/dispatchScheduleService.ts`, `backend/src/__tests__/dispatchScheduleService.test.ts`, `frontend/src/components/dispatch/ImportDispatchExcelModal.tsx`, `frontend/src/pages/dispatch/SchedulePage.tsx`, `frontend/src/i18n/vi.json`, `frontend/src/i18n/en.json`.

---
## Lesson / Update: Đồng bộ Ma trận Quản lý quyền theo cấu trúc Menu Sidebar mới
- **Ngày:** 2026-09-20
- **Severity:** Low
- **Feature liên quan:** Quản lý quyền (`PermissionManagementPage.tsx`), i18n
- **Chi tiết:**
  - Bổ sung nhóm quyền `workflows.view` & `workflows.manage` (Cấu hình quy trình) vào nhóm **Thiết lập người dùng** trên bảng ma trận phân quyền.
  - Cập nhật nhãn phụ đề (Submenu descriptions) trong `vi.json` và `en.json` để phản ánh đầy đủ các tính năng mới: Phụ phí khách hàng (trong Quản lý giá cước), Bảng kê thô (trong Quản lý dữ liệu kế toán), Tài xế (trong Quản lý danh mục).
- **Files liên quan:** `frontend/src/pages/admin/PermissionManagementPage.tsx`, `frontend/src/i18n/vi.json`, `frontend/src/i18n/en.json`.

---
## Lesson / Feature: Xử lý Bảng Kê Thô ND-MCC — Chuẩn hóa số liệu, tính toán công thức Excel và Smart Address Matching
- **Ngày:** 2026-09-20
- **Severity:** Low / Best Practice
- **Feature liên quan:** Xử lý Bảng kê thô 5 nhà & ND-MCC (`bangKeTho`, `ndMccEngine`, `processedV2`, `addressMatcher`)
- **Vấn đề & Bài học:**
  1. **Công thức SUM chia đôi `=SUM(...)/2` vs `=SUM(...)`:**
     - Tại **Bảng A** (>2.5 tấn), các dòng hóa đơn được nhóm theo từng chuyến xe và có dòng chèn `Tổng cộng` của từng xe. Khi tính `TỔNG CỘNG A` của toàn bảng, nếu lấy dải từ dòng đầu đến dòng cuối thì giá trị mỗi dòng bị tính 2 lần (1 lần ở dòng chi tiết hóa đơn, 1 lần ở dòng tổng xe). Kế toán giải quyết bằng công thức chia đôi `=SUM(start:end)/2`.
     - Tuy nhiên, tại **Bảng B** (≤2.5 tấn), các hóa đơn xếp liên tục và không có dòng tổng chuyến xe trung gian. Do đó dòng `TỔNG CỘNG B` phải dùng công thức `=SUM(start:end)` trực tiếp, tuyệt đối không chia 2.
  2. **Chuẩn hóa số liệu kiểu chuỗi trong Excel input (`Processed v2`):**
     - File input kế toán thường có các cột số lượng và trọng lượng dạng text có dấu phẩy ngăn cách hàng nghìn (ví dụ `"1,200"` hay `"12,500.25"`). Khi Excel thực thi công thức `=ROUND(...)` hoặc tra cứu tính toán sẽ dễ bị lỗi `#VALUE!` hoặc không nhận dạng được kiểu số.
     - Tạo sheet `Processed v2` nhân bản và chuẩn hóa sạch kiểu `number` (`parseCellToNumber`), đồng thời tính lại `Khung giá` theo tải trọng thực của chuyến xe (từ cột `5 nhà`) giúp toàn bộ công thức trên các sub-sheets chạy ổn định và chính xác.
  3. **So khớp địa chỉ linh hoạt (`addressMatcher`):**
     - Địa chỉ khách hàng trong thực tế có rất nhiều biến thể (ví dụ có/không có "thửa đất số ...", dấu cách, dấu gạch nối). Việc chỉ so khớp chính xác (`===`) sẽ bỏ sót nhiều khách hàng đã có trong cơ sở dữ liệu.
     - Kết hợp chuẩn hóa dấu + loại bỏ tiền tố thửa đất + substring containment + token overlap (ngưỡng 75%), đồng thời tô màu cảnh báo `#FFF2CC` kèm Note trên ô địa chỉ khi khớp dạng partial match giúp kế toán kiểm soát 100% độ chính xác mà không tốn công nhập liệu lại.
- **Files liên quan:** `backend/src/services/bangKeTho/`, `backend/src/utils/addressMatcher.ts`, `backend/src/utils/routeMatcher.ts`.

---
## Bug: Phụ phí lệch 1 ngày khi chọn ngày bắt đầu
- **Ngày:** 2026-09-17
- **Severity:** High
- **Feature liên quan:** Phụ phí giao hàng (`customerSurchargeService`)
- **Triệu chứng:** Chọn ngày bắt đầu 16/9 bị báo chồng ngày; chọn 17/9 thì tạo được nhưng màn hình hiện 16/9.
- **Root cause:** `pg` parse cột `DATE` thành `Date` lúc 00:00 local. `iso()` gọi `toISOString().slice(0, 10)` nên ở UTC+7 ngày lịch `2026-09-17` thành `2026-09-16`. Cùng phép map dùng cho kiểm tra chồng kỳ, nên kỳ kết thúc 17/9 bị coi là kết thúc 16/9.
- **Fix:** So sánh/hiển thị bằng ngày lịch local (`getFullYear/getMonth/getDate`), và SELECT `start_date::text` / `end_date::text`. Không dùng `toISOString()` cho `DATE`.
- **File sửa:** `backend/src/services/customerSurchargeService.ts`
- **Regression test:** `backend/src/__tests__/customerSurchargeService.test.ts` — `customer surcharge calendar dates`
- **Cần chú ý:** Dữ liệu đã lưu vẫn đúng; chỉ lớp đọc bị lệch. Rule tạo lúc bug còn hiệu lực có thể chồng kỳ thật (ví dụ cùng combo, kỳ cũ kết thúc 17/9 và kỳ mới bắt đầu 17/9).

---
## Change: Dedicated MinIO Bucket/Prefix for Ticket Attachments (`MINIO_BUCKET_TICKET_ATTACHEMENTS`)
- **Ngày:** 2026-09-13
- **Feature:** Theo dõi hóa đơn (`invoice_tracking`), MinIO Storage Configuration
- **Mô tả:** Chuyển toàn bộ tệp đính kèm của chức năng Theo dõi hóa đơn sang lưu trữ tại bucket / thư mục riêng biệt theo biến môi trường `MINIO_BUCKET_TICKET_ATTACHEMENTS` (ví dụ: `phuphatcorp-inspections/ticket_attachments`).
- **Giải pháp:**
  - Cập nhật `env.ts` nạp `env.minio.ticketAttachmentsBucket` từ `MINIO_BUCKET_TICKET_ATTACHEMENTS` (kèm fallback `MINIO_BUCKET_TICKET_ATTACHMENTS` / `MINIO_BUCKET`).
  - Nâng cấp `storageService` hỗ trợ tham số `bucketLocation` tùy biến: tự động phân tách `bucketName` và `prefix`, đảm bảo khởi tạo bucket (`ensureBucket`), tải lên (`upload`), phát sinh URL (`getPublicUrl`), lấy stream (`getStream`), xóa tệp (`delete`) vào đúng vị trí chỉ định.
  - Chuẩn hóa bộ API lưu trữ đồng nhất trên toàn hệ thống (loại bỏ các hàm phân mảnh `putObject`, `getObjectStream`, `deleteObject`), hỗ trợ tham số `customKey` trong `upload` để phục vụ linh hoạt cả tệp chứng từ (sinh tên tự động) lẫn batch cố định (Bảng kê thô).
  - Cập nhật `invoiceTrackingService.uploadDocuments` và `invoiceTrackingService.serveFile` truyền `env.minio.ticketAttachmentsBucket`.
  - Cập nhật `server.ts` tự động `ensureBucket` cho bucket tệp đính kèm khi ứng dụng khởi động.
- **Files sửa:** `backend/src/config/env.ts`, `backend/src/services/storageService.ts`, `backend/src/services/invoiceTrackingService.ts`, `backend/src/services/bangKeTho/index.ts`, `backend/src/server.ts`.

---
## Feature: "Download All" Attached Documents in TicketDetailModal
- **Ngày:** 2026-09-13
- **Feature:** Theo dõi hóa đơn (`TicketDetailModal`)
- **Mô tả:** Bổ sung nút "Tải tất cả (N)" trong modal Chi tiết Ticket cho phép người dùng tải toàn bộ tệp đính kèm về máy chỉ với một lần nhấp.
- **Giải pháp:**
  - Thêm nút `Download All` trên thanh tiêu đề khối *Chứng từ đính kèm* (`TicketDetailModal.tsx`).
  - Hàm `handleDownloadAll` tự động lặp và tải tuần tự các tệp (cách nhau 300ms để tránh trình duyệt chặn popup/download) hỗ trợ cả MinIO và Base64 legacy.
  - Tự động ẩn nút khi ticket chưa có tệp đính kèm nào.
- **Files sửa:** `TicketDetailModal.tsx`, `vi.json`, `en.json`.

---
## Feature: Copy Documents for Same-Day Trips on Mobile (`web_v2_mobile`)
- **Ngày:** 2026-09-13
- **Feature:** Theo dõi hóa đơn trên Mobile (Flutter)
- **Mô tả:** Mang chức năng sao chép ảnh chứng từ từ chuyến xe khác cùng ngày từ Web sang Mobile App.
- **Thực hiện:**
  - `CopyDocumentsModal`: Modal tìm kiếm các chuyến xe cùng ngày đã có ảnh chứng từ, xem trước thumbnails, chọn chuyến xe mẫu, nhập ghi chú và xác nhận sao chép.
  - `ticket_detail_screen.dart`: Bổ sung nút "Sao chép chứng từ" (khi tài xế có quyền nộp chứng từ), hiển thị badge nguồn `🔗 Từ xe [Biển số]` trên các ảnh chứng từ đã sao chép, hỗ trợ render cả ảnh từ MinIO URL và Base64.
  - `document_viewer_dialog.dart`: Nâng cấp dialog xem ảnh phóng to hỗ trợ xem file MinIO qua NetworkImage và hiển thị thông tin xe nguồn nếu là ảnh sao chép.
- **Verify:** `flutter analyze` 0 issues, `flutter test` 36/36 tests pass 100%.

---
## Bug: Timezone 1-day date offset on Flutter Mobile due to missing `.toLocal()`
- **Ngày:** 2026-09-13
- **Severity:** High
- **Feature liên quan:** Toàn bộ Mobile App (`web_v2_mobile`) — Định dạng ngày tháng, tính toán hạn đăng kiểm / bảo hiểm / thay nhớt / điều phối
- **Triệu chứng:** Dữ liệu trên Web hiển thị ngày `03/09/2026` nhưng trên Mobile lại hiển thị `02/09/2026`.
- **Root cause:** Khi backend Node.js `pg` driver serialize cột `DATE` (ví dụ `2026-09-03 00:00:00 GMT+0700`), `res.json()` chuyển thành chuỗi ISO UTC `"2026-09-02T17:00:00.000Z"`.
  - Trên Web: `new Date("2026-09-02T17:00:00.000Z")` được trình duyệt tự động parse theo local time (GMT+7) thành `03/09/2026`.
  - Trên Mobile: `DateTime.parse()` trong Dart giữ nguyên `isUtc = true`. `DateFormat('dd/MM/yyyy').format(date)` định dạng trực tiếp theo ngày UTC (`02/09`) thay vì giờ địa phương.
- **Fix:** 
  1. Thêm `.toLocal()` vào `FormatUtils.formatDate` trong `lib/core/utils/format_utils.dart`.
  2. Thêm `.toLocal()` vào các hàm tính `daysLeft` trong models (`inspection_record.dart`, `vehicle_inspection_summary.dart`, `insurance_record.dart`, `vehicle_insurance_summary.dart`).
  3. Thêm `.toLocal()` khi khởi tạo State ngày trong các Form screens (`inspection_form_screen.dart`, `insurance_form_screen.dart`, `oil_change_form_screen.dart`).
- **Files sửa:** `FormatUtils.dart`, 4 models, 3 form screens, `format_utils_test.dart`.
- **Verify:** `flutter test` pass 33/33 tests.

---
## Bug: `INVALID_DATE` error when copying documents on same-day trips
- **Ngày:** 2026-09-13
- **Severity:** High
- **Feature liên quan:** Theo dõi hóa đơn (`copyDocuments`, `invoiceTrackingService`)
- **Triệu chứng:** Người dùng chọn chuyến xe cùng ngày để sao chép chứng từ nhưng API trả về lỗi 400 `INVALID_DATE` ("Chỉ có thể sao chép chứng từ từ chuyến xe cùng ngày").
- **Root cause:** Cột `ngay` trong PostgreSQL trả về cho Node.js `pg` driver dưới dạng JavaScript `Date` object. Trong JavaScript, phép so sánh `source.ngay !== target.ngay` so sánh theo tham chiếu đối tượng (reference equality) nên luôn luôn trả về `true` (dù 2 chuyến xe có cùng ngày trong database).
- **Fix:** Tạo hàm `normalizeDateString` trích xuất định dạng chuỗi chuẩn `YYYY-MM-DD` từ `Date` hoặc ISO string trước khi so sánh `normalizeDateString(source.ngay) !== normalizeDateString(target.ngay)`.
- **Files sửa:** `backend/src/services/invoiceTrackingService.ts`.

---
## Feature: MinIO Document Migration & Zero-Duplication Same-Day Copy for Invoice Tracking
- **Ngày:** 2026-09-12
- **Feature:** Theo dõi hóa đơn (`invoice_tracking`), MinIO Storage & Copy Documents
- **Mô tả:** 
  - Nâng cấp cơ chế lưu trữ chứng từ hóa đơn từ chuỗi Base64 trực tiếp trong PostgreSQL sang MinIO Object Storage (`phuphatcorp-inspections`).
  - Hỗ trợ tài xế sao chép toàn bộ ảnh chứng từ từ chuyến xe khác cùng ngày (khi 2 xe vào chung 1 điểm giao nhận và chỉ 1 người ở lại chụp phiếu).
- **Giải pháp:**
  - **Tương thích ngược 100%**: Hỗ trợ đồng thời các tệp cũ có `file_data` (Base64) và các tệp mới tải lên MinIO có `filename`.
  - **Không nhân bản file (Zero Duplication)**: Khi chuyến B sao chép từ chuyến A, hệ thống chỉ lưu tham chiếu metadata (`filename` trỏ chung 1 object key trong MinIO bucket, kèm `source_ticket_id` và `source_plate_number`).
  - **Độc lập dữ liệu**: Chuyến A bị xóa thì ảnh của chuyến B vẫn tồn tại và hiển thị bình thường.
  - **Giao diện**:
    - Modal `CopyDocumentsModal`: Tìm kiếm và chọn chuyến xe cùng ngày có ảnh mẫu, xem thumbnail thu nhỏ và ghi chú tài xế.
    - Hiển thị badge `🔗 Từ xe [Biển số]` trên hình ảnh thu nhỏ và modal xem ảnh Lightbox.
  - **Tích hợp Workflow**: Tự động chuyển trạng thái sang `Chờ duyệt` (`pending_review`) và ghi Audit Log chi tiết.
- **Files liên quan:** `invoiceTrackingService.ts`, `invoiceTrackingController.ts`, `routes/invoiceTracking.ts`, `invoiceTrackingApi.ts`, `useInvoiceTracking.ts`, `CopyDocumentsModal.tsx`, `UploadDocumentsModal.tsx`, `DocumentPreview.tsx`, `DocumentViewerModal.tsx`, `TicketDetailModal.tsx`, `PublicTicketViewPage.tsx`.

---
## Bug: Clipboard Copy Failure on Share Ticket Button
- **Ngày:** 2026-09-12
- **Severity:** Medium
- **Feature liên quan:** Theo dõi hóa đơn (`TicketDetailModal`, `ShareTicketDialog`)
- **Triệu chứng:** Người dùng nhấn nút "Chia sẻ" nhưng không sao chép được link vào clipboard.
- **Root cause:**
  1. `navigator.clipboard.writeText` chỉ hoạt động trong Secure Contexts (HTTPS hoặc `localhost`). Trên HTTP (IP remote dev/staging), API này bị trình duyệt chặn hoàn toàn.
  2. Do `navigator.clipboard` được gọi sau `await shareMutation.mutateAsync()` (bất đồng bộ mạng), một số trình duyệt (Safari, iOS, Chrome mobile) xem là "user gesture activation" đã hết hạn và từ chối cấp quyền ghi clipboard.
- **Fix:**
  1. Tạo tiện ích `copyToClipboard` (`frontend/src/utils/clipboard.ts`) hỗ trợ fallback tự động qua `document.execCommand('copy')` và thẻ `<textarea>` ẩn.
  2. Xây dựng modal `ShareTicketDialog`: Tự động mở hộp thoại hiển thị trực tiếp đường link kèm ô input cho phép chọn toàn bộ (`select-all`), nút "Sao chép" và nút "Mở xem trang public" để đảm bảo 100% người dùng luôn lấy được liên kết trong mọi môi trường.
- **Files sửa:** `frontend/src/utils/clipboard.ts`, `frontend/src/components/invoice-tracking/ShareTicketDialog.tsx`, `frontend/src/components/invoice-tracking/TicketDetailModal.tsx`.

---
## Feature: Public Ticket Viewer & Shareable Links
- **Ngày:** 2026-09-12
- **Feature:** Theo dõi hóa đơn (`invoice_tracking`), Public Sharing & Lightbox Gallery
- **Mô tả:** Cho phép chia sẻ đường link công khai của một ticket để người nhận (khách hàng/đối tác) có thể xem toàn bộ chứng từ / hình ảnh đính kèm mà không cần tài khoản đăng nhập.
- **Giải pháp:**
  - Mở rộng bảng `dispatch_schedules` thêm `share_token VARCHAR(64) UNIQUE` (migration `054`).
  - Thêm API bảo mật: `POST /api/invoice-tracking/:id/share` (sinh mã ngẫu nhiên 48-char hex và ghi audit log `SHARE_TICKET`) và `GET /api/public/invoice-tracking/:token` (Public, không yêu cầu JWT).
  - Nâng cấp `DocumentViewerModal` thành Lightbox Gallery Viewer đầy đủ tính năng: nút điều hướng Back (←) / Next (→), phím tắt bàn phím (`ArrowLeft`, `ArrowRight`, `Escape`), chỉ số ảnh (e.g. `2 / 5`).
  - Xây dựng trang độc lập `PublicTicketViewPage.tsx` (`/shared/invoice-tracking/:token`) hỗ trợ responsive mobile-first, Dark/Light theme toggle, và nút tải tất cả tài liệu.
- **Files liên quan:** `054_add_share_token_to_dispatch_schedules.sql`, `invoiceTrackingService.ts`, `invoiceTrackingController.ts`, `publicRoutes.ts`, `invoiceTracking.ts`, `routes/index.ts`, `PublicTicketViewPage.tsx`, `DocumentViewerModal.tsx`, `TicketDetailModal.tsx`, `Router.tsx`.

---
## Change: Dashboard Grid Hub Navigation Architecture for Mobile (`web_v2_mobile`)
- **Ngày:** 2026-09-11
- **Feature:** Kiến trúc điều hướng Dashboard Hub trên Mobile (Flutter)
- **Vấn đề:** Khi số lượng module nghiệp vụ tăng lên (5-6+ tính năng: Điều phối, Hóa đơn, Đăng kiểm, Bảo hiểm, Thay nhớt...), thanh BottomNavigationBar bị quá tải, chật chội và khó mở rộng trong tương lai.
- **Giải pháp:**
  - Chuyển đổi sang kiến trúc **Dashboard Grid Hub (Phương án 1)**:
    - Rút gọn thanh `BottomNavigationBar` về **2 Tab chuẩn mực**: 🏠 **Trang chủ** và 👤 **Tài khoản**.
    - Trang chủ (`DashboardHubTab`) đóng vai trò là Hub trung tâm, chia nhóm tính năng dạng lưới (Grid) theo các phân hệ nghiệp vụ:
      1. **Phân hệ Điều hành & Vận tải**: *Điều phối xe, Theo dõi hóa đơn*.
      2. **Phân hệ Dữ liệu & Bảo trì xe**: *Quản lý đăng kiểm, Quản lý bảo hiểm, Quản lý thay nhớt*.
    - Tự động ẩn hiện các thẻ tính năng (`HubMenuCard`) trên Trang chủ theo phân quyền tài khoản của người dùng.
    - Sẵn sàng mở rộng thêm 10–20 tính năng mới trong tương lai mà không ảnh hưởng tới thanh điều hướng đáy.
- **Verify:** `flutter analyze` 0 issues, `flutter test` 26/26 tests pass 100%.

---
## Feature: Dispatch Schedule Management on Mobile (`web_v2_mobile`)
- **Ngày:** 2026-09-11
- **Feature:** Điều hành vận tải / Bảng điều phối xe trên Mobile (Flutter)
- **Mô tả:** Port toàn bộ chức năng Điều hành vận tải từ Web App sang Mobile Client dùng chung 100% backend API hiện hữu (`/api/dispatch-schedules`).
- **Thực hiện:**
  - `DispatchScheduleScreen`: Màn hình điều phối xe theo ngày (DatePicker + nút Hôm nay + nút Lùi/Tiến ngày) chia làm 3 Tabs trực quan: **Xe nhỏ**, **Xe lớn**, **Lịch ngoài tuyến** kèm badge đếm số lượng chuyến mỗi tab. Card chuyến hiển thị biển số, xe nhà/ngoài, tài xế, điểm nhận hàng, số tấn, CAN, ghi chú và các thao tác Sửa/Xóa.
  - `DispatchFormScreen`: Biểu mẫu tạo chuyến xe mới hỗ trợ chọn loại tuyến, cỡ xe, loại hình xe (xe nhà tự động tra cứu tài xế gán, xe ngoài nhập tay), điểm nhận hàng, tấn, CAN, ghi chú.
  - `DispatchEditDialog`: Hộp thoại chỉnh sửa thông tin điểm nhận, số tấn, CAN, ghi chú của chuyến xe đã có.
  - `HomeScreen`: Tích hợp tab "Điều phối" vào thanh Bottom Navigation Bar, tự động kiểm tra phân quyền `dispatch.view` / `dispatch.manage`.
- **Verify:** `flutter analyze` 0 issues, `flutter test` 26/26 tests pass 100%.

---
## Feature: Silent Auto-Refresh Token & Request Retry Queue for Mobile (`web_v2_mobile`)
- **Ngày:** 2026-09-11
- **Feature:** Authentication Token Lifecycle trên Mobile App
- **Vấn đề:** Khi mở app sau 45 phút, Access Token hết hạn khiến mọi API trả lỗi `401 Unauthorized`. Mobile trước đó chưa lưu `refreshToken` và chỉ xóa token khi gặp 401, ép người dùng phải đăng xuất và nhập lại tài khoản/mật khẩu thủ công.
- **Giải pháp:**
  - **Backend (`authController.ts`)**: Trả cả `refreshToken` trong response body khi `login` / `register` / `refresh` (song song với HttpOnly cookie cho Web). Mở rộng `POST /api/auth/refresh` nhận token từ Cookie, Body hoặc Header.
  - **Mobile (`TokenStorage`)**: Bổ sung hàm lưu & đọc `refreshToken` qua `SharedPreferences`.
  - **Mobile (`ApiClient`)**: Xây dựng cơ chế **Silent Auto-Refresh & Request Retry Queue** trong `Dio Interceptor`:
    1. Khi API nhận mã `401`/`403`, interceptor chặn lại và kiểm tra `_isRefreshing`.
    2. Nếu chưa refresh, gọi ngầm `POST /api/auth/refresh` bằng `refreshToken` (thời hạn 7 ngày) để lấy cặp token mới.
    3. Lưu token mới và retry lại chính xác request ban đầu một cách trong suốt với người dùng.
    4. Nếu có nhiều request đồng thời khi token hết hạn, các request tiếp theo được xếp hàng vào `_refreshQueue` và tự động retry khi refresh hoàn tất.
- **Verify:** `flutter test` pass 22/22 tests, `npm test` backend pass 104/104 tests.

---
## Rule: Cảnh báo và chặn tạo lịch điều phối xe nếu không tìm thấy driver_id
- **Ngày:** 2026-09-11
- **Feature:** Bảng điều phối xe (`dispatchScheduleService` & `ImportDispatchExcelModal`)
- **Mô tả:** Bắt buộc mọi chuyến xe khi tạo (đơn lẻ hoặc Import Excel) phải tìm được tài xế (`driver_id` từ `driver_vehicles` + `drivers`).
- **Thực hiện:**
  - **Frontend (`ImportDispatchExcelModal.tsx`)**: Tra cứu danh mục tài xế hoạt động (`/api/drivers`). Nếu phát hiện biển số chưa được gán tài xế, hiển thị khung cảnh báo màu đỏ nổi bật danh sách các biển số cụ thể không thể insert vào database, đánh dấu dòng lỗi trong bảng preview và loại trừ khi bấm "Xác nhận Import".
  - **Backend (`dispatchScheduleService.ts`)**: Trong `create` và `createBatch`, nếu sau khi tra cứu vẫn không tìm thấy `driver_id`, backend sẽ throw error liệt kê các biển số xe chưa có tài xế, ngăn chặn việc tạo bản ghi mồ côi không có tài xế.

---
## Change: Permission-based Dynamic Navigation for Mobile (`web_v2_mobile`)
- **Ngày:** 2026-09-08
- **Feature:** Phân quyền điều hướng trên Mobile (Flutter)
- **Mô tả:** Ẩn các icon/tab chức năng trên thanh `BottomNavigationBar` của Mobile đối với các chức năng mà người dùng hiện tại không có quyền truy cập.
- **Thực hiện:**
  - `lib/providers/auth_provider.dart`: Thêm phương thức `hasAnyPermission(List<String> codes)`.
  - `lib/screens/home/home_screen.dart`: Chuyển danh sách `destinations` thành mảng động:
    - Tab "Tài khoản": Luôn hiển thị cho mọi người dùng.
    - Tab "Theo dõi HĐ": Chỉ hiển thị khi có quyền `invoice_tracking.view` hoặc `invoice_tracking.manage` (hoặc role `ADMIN`).
    - Tab "Đăng kiểm": Chỉ hiển thị khi có quyền `vehicle_data.view` hoặc `vehicle_data.manage` (hoặc role `ADMIN`).
    - Tab "Bảo hiểm": Chỉ hiển thị khi có quyền `vehicle_data.view` hoặc `vehicle_data.manage` (hoặc role `ADMIN`).
    - Tab "Thay nhớt": Chỉ hiển thị khi có quyền `vehicle_data.view` hoặc `vehicle_data.manage` (hoặc role `ADMIN`).
    - Tự động ẩn `BottomNavigationBar` nếu chỉ có duy nhất 1 tab "Tài khoản", an toàn tránh index out of bounds khi chuyển đổi tài khoản.
- **Verify:** `flutter test` 20/20 tests pass (bao gồm 4 test cases kiểm tra hiển thị phân quyền cho các role ADMIN, TAI_XE, STAFF, VIEWER), `flutter analyze` 0 issues.

---
## Feature: Vehicle Oil Change Management on Mobile (`web_v2_mobile`)
- **Ngày:** 2026-09-08
- **Feature:** Quản lý thay nhớt xe trên Mobile (Flutter)
- **Mô tả:** Port toàn bộ chức năng Quản lý thay nhớt xe từ Web App sang Mobile Client dùng chung 100% backend API hiện hữu (`/api/vehicle-oil-changes`, `/api/vehicles/:id/oil-interval`).
- **Thực hiện:**
  - `OilChangeScreen`: Màn hình chính 2 Tab ("Xe cần thay nhớt" và "Lịch sử thay nhớt"). Tab 1 hiển thị tiến độ km đã đi / định mức km kèm thanh `LinearProgressIndicator` đổi màu theo mức cảnh báo (Đỏ: Quá hạn, Vàng: Sắp đến hạn, Xanh: Bình thường, Xám: Chưa có ODO). Tab 2 hiển thị toàn bộ lịch sử các lần thay nhớt.
  - `OilChangeFormScreen`: Ghi nhận mới và chỉnh sửa lần thay nhớt, chọn xe, chọn ngày, nhập số ODO, chọn loại nhớt nhanh (`15W-40`, `20W-50`...) và ghi chú.
  - `OilIntervalDialog`: Cài đặt số km định mức chu kỳ thay nhớt cho từng xe kèm preset gợi ý nhanh (`3000`, `4000`, `5000`, `6000`, `8000`, `10000` km).
  - `VehicleOilHistoryScreen`: Lịch sử các lần thay nhớt của riêng một xe cụ thể theo thứ tự thời gian.
  - `HomeScreen`: Tích hợp tab thứ 5 "Thay nhớt" vào thanh Bottom Navigation Bar.
- **Verify:** `flutter analyze` 0 issues, `flutter test` 16/16 tests pass 100%.

---
## Feature: Vehicle Insurance Management on Mobile (`web_v2_mobile`)
- **Ngày:** 2026-09-08
- **Feature:** Quản lý bảo hiểm xe trên Mobile (Flutter)
- **Mô tả:** Port toàn bộ chức năng Quản lý bảo hiểm xe từ Web App sang Mobile Client dùng chung 100% backend API hiện hữu (`/api/vehicle-insurances`).
- **Thực hiện:**
  - `InsuranceListScreen`: Tóm tắt bảo hiểm theo xe kèm tìm kiếm nhanh, bộ lọc trạng thái dạng chip (Còn hạn, Sắp hết hạn, Hết hạn, Chưa có BH), badge số ngày còn lại, phân trang và pull-to-refresh.
  - `InsuranceDetailScreen`: Chi tiết đợt bảo hiểm, thông tin xe, tài xế, ngày mua, ngày hết hạn, ghi chú và lưới ảnh chứng từ.
  - `InsuranceImageViewerDialog`: Xem ảnh chứng từ bảo hiểm phóng to với hỗ trợ cử chỉ zoom/pan và 2 nút Back/Next lướt qua lại giữa các ảnh.
  - `InsuranceFormScreen`: Tạo mới / chỉnh sửa bảo hiểm, chọn xe từ danh sách "Xe nhà" (chỉ áp dụng xe nhà theo business rule BR-00), chọn ngày với DatePicker, đính kèm ảnh chụp trực tiếp từ Camera hoặc chọn từ Thư viện ảnh.
  - `InsuranceHistoryScreen`: Lịch sử các lần mua bảo hiểm của 1 xe cụ thể theo thứ tự thời gian.
  - `HomeScreen`: Tích hợp tab thứ 4 "Bảo hiểm" vào thanh Bottom Navigation Bar.
- **Verify:** `flutter analyze` 0 issues, `flutter test` pass 100%.

---
## Feature: Vehicle Inspection Management on Mobile (`web_v2_mobile`)
- **Ngày:** 2026-09-08
- **Feature:** Quản lý đăng kiểm xe trên Mobile (Flutter)
- **Mô tả:** Port toàn bộ chức năng Quản lý đăng kiểm xe từ Web App sang Mobile Client dùng chung 100% backend API hiện hữu (`/api/vehicle-inspections`).
- **Thực hiện:**
  - `InspectionListScreen`: Tóm tắt đăng kiểm theo xe kèm tìm kiếm nhanh, bộ lọc trạng thái dạng chip (Còn hạn, Sắp hết hạn, Hết hạn, Chưa ĐK), badge số ngày còn lại, phân trang và pull-to-refresh.
  - `InspectionDetailScreen`: Chi tiết đợt đăng kiểm, thông tin xe, tài xế, ngày ĐK, ngày hết hạn, ghi chú và lưới ảnh chứng từ.
  - `InspectionImageViewerDialog`: Xem ảnh chứng từ phóng to với hỗ trợ cử chỉ zoom/pan và 2 nút Back/Next lướt qua lại giữa các ảnh.
  - `InspectionFormScreen`: Tạo mới / chỉnh sửa đăng kiểm, chọn xe từ danh sách active, chọn ngày với DatePicker, đính kèm ảnh chụp trực tiếp từ Camera hoặc chọn từ Thư viện ảnh.
  - `InspectionHistoryScreen`: Lịch sử các lần đăng kiểm của 1 xe cụ thể theo thứ tự thời gian.
  - `HomeScreen`: Tích hợp tab thứ 3 "Đăng kiểm" vào thanh Bottom Navigation Bar.
- **Verify:** `flutter analyze` 0 issues, `flutter test` pass 100%.

---
## Feature: Image Gallery Carousel (Back/Next Navigation) for Mobile Invoice Tracking
- **Ngày:** 2026-09-08
- **Feature:** Xem ảnh chứng từ hóa đơn trên Mobile (`DocumentViewerDialog`)
- **Mô tả:** Khi tài xế vào chi tiết chuyến xe và chạm vào hình ảnh để xem phóng to, dialog hiển thị 2 icon điều hướng Back (ChevronLeft) / Next (ChevronRight) nổi trên ảnh và huy hiệu số trang (vd: `1/4`), cho phép lướt xem lần lượt các hình ảnh chứng từ trong ticket.
- **Thực hiện:**
  - `mobile/web_v2_mobile/lib/screens/invoice_tracking/dialogs/document_viewer_dialog.dart`: Nâng cấp sang `StatefulWidget`, quản lý `currentIndex` và danh sách `documents`. Bổ sung 2 nút `IconButton.filled` nổi trên ảnh kèm auto disable khi ở đầu/cuối danh sách.
  - `mobile/web_v2_mobile/lib/screens/invoice_tracking/ticket_detail_screen.dart`: Truyền `ticket.documents` và `index` khi mở `_viewDocument`.
- **Verify:** `flutter analyze` & `flutter test` pass 100%.

---
## Perf: Invoice Tracking List Payload & Database Socket Optimization
- **Ngày:** 2026-09-08
- **Feature:** Theo dõi hóa đơn (`/api/invoice-tracking`) trên Web App & Mobile
- **Vấn đề:** 
  1. API list `GET /api/invoice-tracking` trước đây SELECT trực tiếp cột `documents` chứa toàn bộ `file_data` (Base64 ảnh chụp 2-5MB/ảnh) khiến payload 20 dòng lên tới 20-60MB, gây nghẽn băng thông, lag UI thread và timeout trên cả Web và Mobile.
  2. `pool.on('connect')` gọi `client.query("SET timezone...")` bất đồng bộ làm nghẽn socket và đứt kết nối DB (`Connection terminated unexpectedly`).
- **Fix:**
  1. Dùng PostgreSQL JSONB aggregation `SELECT COALESCE(jsonb_agg(d - 'file_data'), '[]'::jsonb) FROM jsonb_array_elements(documents) d` trong câu SELECT list để loại bỏ chuỗi Base64 nặng, chỉ giữ metadata và trả về payload siêu nhẹ (~15KB). API detail `getById` vẫn giữ đầy đủ `file_data`.
  2. Chuyển cấu hình timezone sang connection parameter `options: '-c timezone=Asia/Ho_Chi_Minh'` và bật `keepAlive: true` trong `database.ts`.
  3. Tạo migration `053_perf_invoice_tracking_index.sql` thêm composite index `idx_dispatch_schedules_invoice_list`.
  4. Thêm bypass cho `UserRole.ADMIN` trong `requirePermission` middleware.
- **Kết quả:** Dung lượng payload API giảm từ **~40MB xuống ~15KB** (giảm 99.9%). Thời gian phản hồi API từ **8-15s xuống < 200ms**.
- **Files sửa:** `backend/src/services/invoiceTrackingService.ts`, `backend/src/config/database.ts`, `backend/src/middleware/auth.ts`, `backend/src/migrations/053_perf_invoice_tracking_index.sql`.

---
## Bug: CORS Preflight block Flutter Web / Dynamic Localhost Ports
- **Ngày:** 2026-09-08
- **Severity:** High
- **Feature liên quan:** Authentication, API Preflight, Mobile/Flutter Web client
- **Triệu chứng:** Khi chạy client Flutter Web (`flutter run -d chrome`), browser gửi request từ origin động như `http://localhost:53734` tới `http://localhost:3021/api/auth/login` bị block CORS do backend trả lỗi `No 'Access-Control-Allow-Origin' header is present on the requested resource`.
- **Root cause:** Trong `backend/src/app.ts`, mảng `allowedOrigins` chỉ chứa các port cố định `5173`, `5174`. Khi client dev server chạy ở port khác của localhost/127.0.0.1, hàm callback CORS báo lỗi khiến Express trả về 500 error không kèm header `Access-Control-Allow-Origin`.
- **Fix:** Thêm regex check `const localhostRegex = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;` cho phép mọi port của `localhost` và `127.0.0.1` trong môi trường phát triển local, đồng thời giữ nguyên danh sách domain production.
- **Files sửa:** `backend/src/app.ts`, `backend/src/__tests__/cors.test.ts`
- **Regression test:** `backend/src/__tests__/cors.test.ts` pass 100%.

---
## Feature: Tab Thống kê theo dõi hóa đơn theo tài xế
- **Ngày:** 2026-09-02
- **Severity:** Medium
- **Feature liên quan:** Theo dõi hóa đơn (`invoice_tracking`), Báo cáo & Thống kê
- **Mô tả:** Bổ sung tab Thống kê cho phép xem số lượng ticket của từng tài xế tương ứng từng trạng thái (Tạo mới, Chờ duyệt, Yêu cầu bổ sung, Hoàn thành, Tổng cộng, Tỷ lệ hoàn thành). Cho phép lọc theo biển số xe, tài xế và khoảng thời gian.
- **Giải pháp:**
  - Viết truy vấn SQL tổng hợp hiệu quả với `COUNT(*) FILTER (WHERE ...)` và `array_agg(DISTINCT bien_so)` nhóm theo tài xế.
  - Tích hợp Data Scope: Tài xế chỉ xem được thống kê của chính mình; Quản lý xem theo phạm vi được phân quyền.
  - Cung cấp API `GET /api/invoice-tracking/statistics` và component `InvoiceTrackingStatsTab` với 5 thẻ KPI + bảng phân tích chi tiết.
- **Files liên quan:** `invoiceTrackingService.ts`, `invoiceTrackingController.ts`, `invoiceTracking.ts`, `invoiceTrackingApi.ts`, `useInvoiceTracking.ts`, `InvoiceTrackingStatsTab.tsx`, `InvoiceTrackingPage.tsx`.

---
## Feature Refactor: Audit Timeline cho Invoice Tracking
- **Ngày:** 2026-09-02
- **Severity:** Medium
- **Feature liên quan:** Theo dõi hóa đơn (`invoice_tracking`), Audit Logging
- **Mô tả:** Người dùng cần theo dõi lịch sử thao tác của từng ticket hóa đơn để biết ai đã tạo, ai upload chứng từ, ai duyệt hoặc yêu cầu bổ sung kèm lý do.
- **Giải pháp:**
  - Tận dụng bảng `audit_logs` có sẵn và service `auditService.logAudit` để ghi nhận các sự kiện nghiệp vụ (`UPLOAD_DOCUMENTS`, `REQUEST_SUPPLEMENT`, `REVIEW_FINISH`).
  - Cung cấp API `GET /api/invoice-tracking/:id/history` trả về danh sách lịch sử có JOIN `users` để hiển thị tên đầy đủ `user_full_name`.
  - Tự động bổ sung synthetic event `CREATE` nếu chuyến xe cũ chưa có log tường minh.
  - Xây dựng component Timeline trực quan với icon và màu sắc trạng thái tương ứng trong `TicketDetailModal.tsx`.
- **Files liên quan:** `invoiceTrackingService.ts`, `invoiceTrackingController.ts`, `invoiceTracking.ts`, `invoiceTrackingApi.ts`, `useInvoiceTracking.ts`, `TicketDetailModal.tsx`.

---
## Lesson: Đồng bộ Permission Matrix, Sidebar và API Routes
- **Ngày:** 2026-08-31
- **Severity:** Medium
- **Feature liên quan:** Quản lý quyền, Sidebar, Catalog & Job APIs
- **Triệu chứng:**
  - Quyền `logs.view` bị thiếu trong điều kiện mở menu cha "Thiết lập người dùng".
  - Trang Cấu hình Job (`ReconcileJobPage`) check sai permission `accounting_data.manage` thay vì `jobs.manage`.
  - Một số API route danh mục (`innerCityCustomers`, `promoItems`, `deliveryPoints`) thiếu middleware `requirePermission`.
  - Quyền cũ `transport.*` dư thừa trong DB và thiếu key i18n của các permission mới.
- **Fix:**
  - Bổ sung `logs.view` vào `showUserSettings` trong `MainLayout.tsx`.
  - Sửa `ReconcileJobPage.tsx` sang `jobs.manage`.
  - Thêm `requirePermission('catalog.view')` và `requirePermission('catalog.manage')` vào các routes danh mục.
  - Tạo migration `050_cleanup_transport_permissions.sql` dọn dẹp `transport.*` và bổ sung đầy đủ i18n `modules` & `permCodes` trong `vi.json` / `en.json`.
- **Files sửa:** `MainLayout.tsx`, `ReconcileJobPage.tsx`, `DashboardPage.tsx`, `innerCityCustomers.ts`, `promoItems.ts`, `deliveryPoints.ts`, `vi.json`, `en.json`, `050_cleanup_transport_permissions.sql`.


---

## Bug: Delivery Data Processing — Vehicle sort wrong because sort key ≠ display key (.slice(-9))
- **Ngày:** 2026-04-26
- **Severity:** High
- **Feature liên quan:** Xử lý Data Giao Hàng (DeliveryDataPage) — 5 Nhà Processing Flow
- **Triệu chứng:** Output file hiển thị biển số `85H 01932` trước `47H 02023` — thứ tự biển số hiển thị không tăng dần. 6 lỗi sort trong 74 khối.
- **Root cause:** `compareVehicleNumbers(a.vehicle, b.vehicle)` so sánh **full source string** (vd: `PPH 85H 01932`, `PPH-47H 02023`), nhưng output hiển thị `.slice(-9)` (vd: `85H 01932`, `47H 02023`). Các prefix PPH có format khác nhau: `PPH ` (space) vs `PPH-` (dash). ASCII space (32) < dash (45), nên `PPH 85H` sort trước `PPH-47H`, tạo ra thứ tự sai khi nhìn ở output.
- **Fix:** Đổi sort comparator từ `compareVehicleNumbers(a.vehicle, b.vehicle)` thành `compareVehicleNumbers(a.vehicle.slice(-9), b.vehicle.slice(-9))` — sort theo biển số hiển thị thay vì full source string.
- **File sửa:** `frontend/src/utils/processDeliveryData.ts:631-633`
- **Regression test:** Node script verify 210 groups, 0 sort errors (displayed). TypeScript typecheck pass, lint pass.
- **Cần chú ý:** Khi sort key và display key khác nhau (do truncation/slicing), luôn sort theo display key. Verify sort bằng cách so sánh giá trị **hiển thị** trong output, không phải giá trị source. Verification script trước đó check full vehicle strings nên report 0 errors — sai vì không phản ánh output thực tế.


---

## Change: Delivery Data Processing — Remove pre-sort, add final sort groups by vehicle
- **Ngày:** 2026-04-25
- **Severity:** Medium
- **Feature liên quan:** Xử lý Data Giao Hàng (DeliveryDataPage) — 5 Nhà Processing Flow
- **Bối cảnh:** User feedback: pre-sort rows + sort groups trong quá trình processing gây phức tạp không cần thiết. Thay vì sort rows trước grouping, user chỉ muốn groups được sort theo **Số xe tăng dần** ở cuối cùng.
- **Quyết định:** Bỏ Step 0 (pre-sort 3-level: vehicle → date → invoice) → Thêm final sort groups theo vehicle ASC (sau khi grouping và sort mỗi group).
- **Thực hiện:**
  - Xóa Step 0 pre-sort từ `processDeliveryData.ts` (dòng 533-559)
  - Cập nhật Step 3: từ "sort groups by (Date, Vehicle)" → "final sort groups by Vehicle ASC"
  - Dùng `compareVehicleNumbers()` để handle "[PREFIX][NUMBER]" format (e.g. "50H 55116")
- **Impact:** Output file groups giờ chỉ theo Số xe tăng dần, bất kể ngày hóa đơn
- **Kiểm tra:** Build ✅, lint ✅, no TypeScript errors ✅
- **Cần chú ý:** Pre-sort rows có tác dụng "warm-up" ordering cho grouping (Map insertion order). Khi bỏ pre-sort, groups sẽ theo thứ tự xuất hiện từ grouping logic (vehicle + date + customer), rồi mới được sắp xếp lại theo vehicle ở cuối. Không ảnh hưởng kết quả, chỉ thay đổi thứ tự xử lý.

---

### i18n t() — key có dấu chấm bị split nhầm làm path separator
- **Ngày:** 2026-04-07
- **Severity:** Medium
- **Feature liên quan:** Permission Management — permission matrix
- **Triệu chứng:** UI hiển thị key thô `permissions.permCodes.dashboard.view` thay vì tên dễ đọc
- **Root cause:** Hàm `t()` trong `i18n.tsx` split key theo `.` để traverse JSON. Khi perm.code có dấu chấm (`dashboard.view`), key `permissions.permCodes.dashboard.view` bị traverse thành 4 cấp → không tìm thấy → trả về key string (truthy, nên `|| fallback` không kích hoạt).
- **Fix:** Đổi JSON keys trong `permCodes` từ `"dashboard.view"` → `"dashboard_view"` (dùng `_`). Trong component gọi `perm.code.replace(/\./g, '_')` trước khi dùng làm i18n key.
- **Cần chú ý:** Không bao giờ đặt i18n key có dấu chấm nằm trong giá trị interpolation (`${variable}`). Nếu giá trị có dấu chấm tự nhiên (code, enum), phải normalize trước khi dùng làm key.

---

### i18n import type — Vite SyntaxError cho interface export
- **Ngày:** 2026-04-07
- **Severity:** High
- **Feature liên quan:** RBAC — rolesApi, permissionsApi, useRoles
- **Triệu chứng:** `Uncaught SyntaxError: The requested module does not provide an export named 'Role'`
- **Root cause:** TypeScript interface chỉ tồn tại ở compile-time. Vite/esbuild strip interfaces ra khỏi JS output. Nếu dùng `import { Role }` (không phải `import type`), JS runtime cố import một export không tồn tại.
- **Fix:** Dùng `import type { Role }` cho type-only imports. Nếu import cả value lẫn type từ cùng 1 file: tách thành 2 dòng — `import { valueExport }` và `import type { TypeExport }`.
- **Cần chú ý:** Vite + esbuild strict hơn tsc về type imports. Luôn dùng `import type` cho interface/type-only imports trong dự án này.

---

### createBrowserRouter + AuthProvider — React Context lỗi

- **Ngày:** 2026-03-30
- **Vấn đề:** Dùng `createBrowserRouter` (data router) với AuthProvider bên trong → `useNavigate()` bị crash với lỗi "useNavigate() may be used only in the context of a <Router> component"
- **Nguyên nhân:** `createBrowserRouter` tạo Router context outside React tree — các component được render bên trong không truy cập được context từ parent.
- **Fix:** Chuyển sang `<BrowserRouter>` + `<Routes>` JSX. AuthProvider phải nằm bên trong `<BrowserRouter>` trong `App.tsx`. Navigation xử lý tại page level thay vì trong AuthProvider.
- **Prevention:** Luôn dùng `BrowserRouter` JSX khi cần React Context integration. Chỉ dùng `createBrowserRouter` khi cần data router features (loader/action) và KHÔNG có context-dependent components.

---

### AuthProvider chứa useNavigate()

- **Ngày:** 2026-03-30 → crash vì AuthProvider render trước Router mount.
- **Nguyên nhân:** React hooks for navigation yêu cầu Router context đã mounted. AuthProvider là một context consumer/producer nằm ở top-level — không có guarantee về thứ tự mount.
- **Fix:** Tách biệt — AuthContext chỉ quản lý state (login/logout/setUser), không chứa navigation. Page components tự gọi `useNavigate()` sau khi auth action hoàn tất.
- **Prevention:** Quy tắc: Context = State management, Page = Navigation/Behavior. Không mix hai concerns trong cùng component.

---

### Import statements ở dưới cùng file

- **Ngày:** 2026-03-30
- **Vấn đề:** LoginPage và RegisterPage có `import axios` và `import React` ở dưới cùng file sau tất cả code → `useState` undefined, `axios.isAxiosError` undefined.
- **Nguyên nhân:** Lỗi của agent khi scaffold code — import không ở top-level.
- **Fix:** Di chuyển tất cả imports lên trên cùng file, dùng `import { useState }` thay vì `React.useState`.
- **Prevention:** ESLint rule `imports-first` sẽ bắt được lỗi này. Cần setup ESLint cho project.


---

### API response structure mismatch

- **Ngày:** 2026-03-30
- **Vấn đề:** Login thành công (backend 200) nhưng frontend không navigate — dashboard trắng.
- **Nguyên nhânân:** Backend trả `{ success, message, data: { user, accessToken } }`. Frontend `authApi` định nghĩa `AuthResponse` là `{ user, tokens: { access_token } }` — 2 lớp mismatch: (1) `accessToken` flat vs nested, (2) Double unwrap cần thiết vì `axiosClient.post<{ data: AuthResponse }>()` + `response.data.data`.
- **Fix:** Correct `AuthResponse` type và unwrap: `response.data.data` để lấy `{ user, accessToken }`.
- **Prevention:** Backend và frontend nên share common types (ví dụ: qua một shared package hoặc copy-paste types). Khi scaffold nên kiểm tra type consistency giữa hai sides.


---

### DELETE /api/users/:id 500 — FK constraint violation

- **Ngày:** 2026-03-31
- **Severity:** High
- **Feature liên quan:** User Management — Delete User
- **Triệu chứng:** `DELETE http://localhost:3021/api/users/:id` trả 500. Error: `update or delete on table "users" violates foreign key constraint "user_activities_target_user_id_fkey"`.
- **Root cause:** Bảng `user_activities` có FK `target_user_id → users.id` và `actor_id → users.id` (NOT NULL / no cascade). Bảng `users` tự-reference qua `created_by → users.id` và `updated_by → users.id`. Khi DELETE user, PostgreSQL từ chối vì còn FK references từ các bảng này.
- **Fix:** Trong `userService.deleteUser()`, trước khi `DELETE FROM users` cần:
  1. `DELETE FROM user_activities WHERE target_user_id = $id OR actor_id = $id`
  2. `UPDATE users SET created_by = NULL WHERE created_by = $id`
  3. `UPDATE users SET updated_by = NULL WHERE updated_by = $id`
  4. `DELETE FROM users WHERE id = $id`
- **File sửa:** `backend/src/services/userService.ts`
- **Regression test:** Create user → DELETE user → HTTP 200 ✅
- **Cần chú ý:** Khi thiết kế schema có FK references đến users, cần cân nhắc `ON DELETE CASCADE` hoặc `ON DELETE SET NULL` ngay từ đầu trong migration. Audit log tables (`user_activities`) nên dùng `ON DELETE SET NULL` để giữ lịch sử nhưng không block delete.


---

### xlsx 0.18.5 community edition không ghi cell styles — dùng exceljs để write

- **Ngày:** 2026-04-01
- **Severity:** Low
- **Feature liên quan:** Delivery Data Processing — export Excel output
- **Triệu chứng:** Header row của output Excel không tô màu vàng dù đã set `cell.s = { fill: ... }` và dùng `{cellStyles: true}` trong write options.
- **Root cause:** `xlsx` 0.18.5 (SheetJS community edition) không serialize thuộc tính `s` khi gọi `XLSX.write()`. Style set trong memory bị bỏ qua hoàn toàn — đọc lại file chỉ thấy `{"patternType":"none"}`. Cả hai cách (có/không có `cellStyles: true`) đều không giúp được.
- **Fix:** Giữ `xlsx` để đọc file input. Dùng `exceljs` để tạo và ghi file output — `cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }` hoạt động đúng.
- **File sửa:** `frontend/src/utils/processDeliveryData.ts` — Step 5 dùng `exceljs.Workbook` thay vì `XLSX.utils.book_new()`
- **Cần chú ý:** `xlsx` community edition chỉ đọc styles từ file có sẵn, không ghi styles mới. Khi cần output Excel có formatting (màu sắc, bold, border...) → luôn dùng `exceljs`. Tên biến `buffer` bị trùng với biến đọc file input — đặt tên là `outBuffer`.


---

### Delivery Data grouping logic — dynamic group key dựa trên threshold và multi-value field

- **Ngày:** 2026-04-18
- **Severity:** Medium
- **Feature liên quan:** Delivery Data Processing — grouping algorithm (Step 5.2)
- **Thay đổi:** Group key không còn cố định `(Số tàu/xe + Ngày HĐ)` mà thay đổi động:
  1. Group sơ bộ theo `(Số tàu/xe + Ngày HĐ + Tên KH)`
  2. Tính `SUM(HĐ Trọng lượng) / 1000` của group
  3. Nếu `< 13`: giữ nguyên group key
  4. Nếu `>= 13`: parse cột "Thông tin bổ sung" (split bằng dấu phẩy/xuống dòng)
     - Có từ 2 giá trị → thêm "Thông tin bổ sung" vào group key
     - Chỉ 1 giá trị hoặc rỗng → giữ nguyên
- **File sửa:** `frontend/src/utils/processDeliveryData.ts` — Step 1 (grouping logic)
- **Cần chú ý:**
  - Logic grouping phức tạp nên tách thành 2 bước: preliminary grouping → final grouping adjustment
  - Threshold (13) là hardcoded — nếu cần thay đổi sau này, cân nhắc extract thành constant hoặc config
  - Multi-value detection dùng regex `/[,\n\r]+/` để split — linh hoạt với nhiều format input (comma-separated, newline-separated)
  - BREAKING CHANGE: Users có dữ liệu cũ sẽ thấy output phân nhóm khác so với trước đây

---

### Excel number format — exceljs không set numFmt property
- **Ngày:** 2026-04-18
- **Severity:** Medium
- **Feature liên quan:** Delivery Data Processing — Excel output formatting
- **Triệu chứng:** Output Excel mất thousand separator format cho cột số — "Số lượng (DVT bán hàng)" hiển thị `10` thay vì `10.000`, SP Trọng lượng hiển thị `1234.567` thay vì `1.234.567`.
- **Root cause:** `exceljs` write cells không tự động apply number format. Mặc dù cell value là `number` type, Excel hiển thị số thuần (raw number) vì không có thuộc tính `cell.numFmt` — thuộc tính này quyết định cách hiển thị number trong Excel (thousand separator, decimals, percentage, currency...).
- **Fix:** Sau khi `ws.addRow(row)`, loop qua các cells có index thuộc number columns và set `cell.numFmt`:
  - `NUM_FMT_THOUSAND = '#,##0'` cho "Số lượng" (integer với thousand separator)
  - `NUM_FMT_DECIMAL = '#,##0.000'` cho "SP Trọng lượng", "HĐ Trọng lượng", "Round(MT)", factory columns (decimal 3 chữ số với thousand separator)
  - Tạo 2 column maps riêng: `PROCESSED_NUMBER_COLS` (39 cols) và `FACTORY_NUMBER_COLS` (41 cols)
  - Thêm param `isFactorySheet: boolean` vào `writeSheetRows()` để chọn đúng map
  - Chỉ apply format khi `typeof cell.value === 'number'` để tránh lỗi với text/date cells
- **File sửa:** `frontend/src/utils/processDeliveryData.ts` — constants (line ~22-23), column maps (line ~256-279), `writeSheetRows()` function (line ~830-850), function calls (line ~867, ~873)
- **Regression test:** `docs/testing/bugfix-excel-number-format-test-checklist.md` — 10 manual test cases (Số lượng, SP/HĐ Trọng lượng, Round(MT), separator rows, factory sheets, header row preservation, text columns không bị ảnh hưởng)
- **Cần chú ý:**
  - ExcelJS cell index là 1-based (`eachCell` callback nhận `colNumber`), cần `-1` khi map với array index 0-based
  - Header row (rowIndex === 0) không bị ảnh hưởng vì không có number values → type check tự động skip
  - Separator rows cũng có number cells → cần apply format như data rows thông thường
  - Backward compatibility: không thay đổi parsing logic (đọc file vẫn dùng xlsx) — chỉ thay đổi output formatting
  - `eachCell({ includeEmpty: false })` để bỏ qua empty cells khi apply format → tránh set format cho cells rỗng

---

### pg driver serialize DATE column thành ISO UTC timestamp — MasterPlateMap key không match
- **Ngày:** 2026-04-19
- **Severity:** High
- **Feature liên quan:** Xử lý Data Gạo (RiceDeliveryDataPage) — buildMasterPlateMap / filterRiceData
- **Triệu chứng:** Filter trả về 0 dòng khớp dù biển số và ngày nhìn bằng mắt là đúng.
- **Root cause:** `pg` driver Node.js tự động convert PostgreSQL `DATE` column thành JS `Date` object. Khi JSON serialize (Express `res.json()`), Date UTC midnight của Việt Nam bị lệch 1 ngày: `"2026-03-02"` (DB) → `"2026-03-01T17:00:00.000Z"` (API response). Frontend dùng string này làm key trong `MasterPlateMap`, còn Excel parse ra `"2026-03-02"` → hai key không bao giờ bằng nhau → zero match.
- **Fix:** Cast `ds.ngay::text as ngay` trong SQL SELECT của `deliveryScheduleService.list()`. pg trả string `"2026-03-02"` thay vì Date object → không bị timezone convert.
- **File sửa:** `backend/src/services/deliveryScheduleService.ts` — dòng `ds.ngay` trong SELECT list query
- **Regression test:** Manual — query DB trực tiếp với `ngay::text` xác nhận trả `"2026-03-02"`.
- **Cần chú ý:** Bất cứ khi nào SELECT `DATE` column qua `pg` driver mà cần dùng làm string key hoặc compare với string từ frontend/file → luôn dùng `column::text`. Không dùng `column` trực tiếp vì pg tự convert sang JS Date với UTC timezone.

---


- **Ngày:** 2026-04-19 (revised 2026-04-19)
- **Severity:** High
- **Feature liên quan:** Xử lý Data Gạo (RiceDeliveryDataPage) — parseRiceFile
- **Triệu chứng:** File Excel ngày 2/3/2026 → sau khi parse ra 1/3/2026 → filter trả về 0 dòng khớp.
- **Root cause:** `xlsx` với `cellDates: true` tạo Date object bằng **LOCAL time constructor** (ví dụ `new Date(2026, 2, 2, 0, 0, 0)`), nhưng thực tế time component không phải midnight mà là `23:59:30` local — do xlsx tính giờ từ fractional serial. Kết quả: cả `getDate()` lẫn `getUTCDate()` đều trả sai ngày. Ví dụ: serial 46083 (2/3/2026) → Date ISO `2026-03-01T16:59:30.000Z` → `getDate()` = 1, `getUTCDate()` = 1 → đều sai.
- **Fix đúng:** Dùng `cellDates: false` khi `XLSX.read()` — xlsx giữ nguyên serial number. `parseRawDate` branch `typeof val === 'number'` gọi `excelSerialToDate()` dùng `Date.UTC(1899, 11, 30 + serial)` → luôn đúng bất kể timezone.
- **File sửa:** `frontend/src/utils/processRiceData.ts` — đổi `cellDates: true` → `cellDates: false` trong `XLSX.read()` call; cập nhật comment trong branch `instanceof Date`.
- **Regression test:** Node smoke test — parse file thực tế: không còn `2026-03-01`, có `2026-03-02` đến `2026-03-14` ✅
- **Cần chú ý:** **KHÔNG BAO GIỜ dùng `cellDates: true`** khi đọc Excel file trong project này. `xlsx` không tạo UTC midnight — nó tạo Date với time component không ổn định. Luôn dùng `cellDates: false` + xử lý serial number qua `excelSerialToDate()`. Entry trước (ghi dùng `getUTC*`) là sai — đã được sửa lại.

---

## Change: Driver Invoices — Đổi label Ghi chú + popup số HĐ + format so_xe
- **Ngày:** 2026-06-15
- **Severity:** Medium
- **Feature liên quan:** Hóa đơn tài xế (Driver Invoices)
- **Thay đổi:**
  1. Đổi label cột "Số HĐ (gốc)" → "Ghi chú", thêm filter "Ghi chú..." vào filter bar
  2. Badge HĐ `[5]` clickable → popup `InvoiceNumbersPopup` hiển thị danh sách số hóa đơn
  3. Format `so_xe` khi insert: bỏ `-`, `,`, space → VD "50H-55116" → "50H55116"
- **Thực hiện:**
  - Migration 015: `UPDATE driver_invoices SET so_xe = regexp_replace(...)` normalize dữ liệu cũ
  - BE: thêm `ghi_chu` filter vào `driverInvoiceService.list()` + `driverInvoiceController`
  - FE: thêm `ghi_chu` vào `DriverInvoiceFilters` type + API params
  - FE: hàm `normalizeSoXe()` trong `parseDriverInvoiceFile.ts`
  - FE: component `InvoiceNumbersPopup` mới — modal nhỏ hiển thị badge numbers
  - FE: `DriverInvoicesPage` — đổi header cột, thêm filter input, grid 6→7 cols, badge thành button
- **Cần chú ý:** Khi normalize dữ liệu cũ, phải chạy migration TRƯỚC khi thay đổi parser để đảm bảo duplicate check hoạt động đúng (UNIQUE index dùng `so_xe`). Nếu không, dữ liệu cũ `"50H-55116"` và mới `"50H55116"` sẽ là 2 record khác nhau.

---

## Bug: Lịch điều phối xe không hiển thị ticket cho tài xế do thiếu driver_id
- **Ngày:** 2026-09-11
- **Severity:** High
- **Feature liên quan:** Bảng điều phối xe (`dispatchScheduleService`) & Theo dõi hóa đơn (`invoiceTrackingService`)
- **Triệu chứng:** Người điều phối tạo lịch xe hoặc Import Excel cho xe (e.g. `50E16461`), nhưng khi tài xế (`16461`, role `TAI_XE`) đăng nhập thì danh sách ticket trống.
- **Root cause:** Khi tạo hoặc import lịch xe vào `dispatch_schedules`, trường `driver_id` bị để trống (`NULL`). Phân quyền dữ liệu (Data scope) của role `TAI_XE` là `owner` (`driver_id = userId OR created_by = userId`), nên tài xế không thấy ticket của xe mình phụ trách.
- **Fix:**
  1. `dispatchScheduleService.ts`: Tự động tra cứu `vehicle_id` (từ bảng `vehicles`) và `driver_id` (từ bảng `driver_vehicles` + `drivers`) theo biển số xe nếu chưa được truyền từ frontend.
  2. Migration `048_backfill_dispatch_schedules_driver_id.sql`: Chạy câu lệnh UPDATE cập nhật `driver_id`, `vehicle_id`, và `tai_xe` cho toàn bộ các bản ghi `dispatch_schedules` lịch sử.
- **Files:** `backend/src/services/dispatchScheduleService.ts`, `backend/src/migrations/048_backfill_dispatch_schedules_driver_id.sql`, `backend/src/__tests__/dispatchScheduleService.test.ts`.

---

## Change: Driver Invoices — Chuyển format import sang HCM + Tỉnh sheets
- **Ngày:** 2026-06-17
- **Severity:** Medium
- **Feature liên quan:** Hóa đơn tài xế — Upload Excel
- **Thay đổi:** Chuyển từ format cũ (sheet "XE NHỎ", rows 8+, columns B-G) sang format mới (sheets "HCM" + "Tỉnh", rows 5+(0-indexed), columns A-F). Column ngay có thể là decimal serial (Math.floor trước khi parse).
- **Files:** `frontend/src/utils/parseDriverInvoiceFile.ts` — extract `parseSheetRows()`, đọc cả 2 sheet.
- **Cần chú ý:** Format mới có decimal date serial (vd: 46189.62269) — cần `Math.floor(serial)` trước khi parse date code. Skip rows có `ma` rỗng, `ngay` invalid, `so_xe` rỗng, hoặc `ghi_chu` rỗng. Cột B (ten_tx) có thể chứa driver code dạng số ("0", "55129") — giữ nguyên.

---

## Anti-patterns Tránh Lặp Lại

### 1. Không để import ở dưới cùng file
Luôn đặt tất cả imports ở trên cùng. Dùng named imports thay vì namespace import (`import React from 'react'` → `import { useState } from 'react'`).

### 2. Không dùng createBrowserRouter khi có React Context
`createBrowserRouter` không tương thích với `createContext`. Dùng `<BrowserRouter>` JSX.

### 3. Không mix concerns trong một component
AuthProvider = state only. Navigation = page level. Validation = form library. Không nhét mọi thứ vào một chỗ.

### Upload lịch đi hàng fail-toàn-bộ khi STT không phải số
- **Ngày:** 2026-06-30
- **Severity:** High
- **Feature liên quan:** Lịch đi hàng (Delivery Schedule) — Upload Excel
- **Triệu chứng:** Upload file Excel lịch đi hàng bị báo lỗi "STT không phải số hợp lệ". Chỉ một vài sheet có dòng tổng kết cuối (TỔNG TIỀN XE, NGƯỜI, MỖI NGƯỜI, TIỀN PHÁT SINH) gây fail toàn bộ upload.
- **Root cause:** `parseColumn()` trong `deliveryScheduleService.ts` fail-fast — nếu bất kỳ dòng nào có STT non-numeric, push error và throw `VALIDATION_ERRORS` khiến toàn bộ upload bị reject. Các dòng tổng kết cuối sheet có ColG chứa text thay vì số → `parseInt()` NaN.
- **Fix:** Chuyển lỗi STT thành skip — khi `parseInt(stt)` NaN → `continue` (bỏ qua dòng, tương tự cách xử lý TẤN best-effort). Đồng thời sửa Bug `!stt` falsy check khiến STT=0 bị bỏ qua → `stt == null || stt === '' || (!noi_giao && !so_xe)`.
- **File sửa:** `backend/src/services/deliveryScheduleService.ts` — dòng 194 (BR-001 skip rule) + dòng 206-215 (STT parsing)
- **Cần chú ý:** Khi parse dữ liệu từ Excel, không nên dùng fail-fast cho từng ô — dùng best-effort skip với optional field. Chỉ fail-fast khi vi phạm business rule thực sự (VD: duplicate, thiếu field bắt buộc). Các dòng tổng kết/thống kê ở cuối sheet là pattern phổ biến trong Excel thực tế.

### DateInput onChange không nhận value — callers vẫn dùng (e) => e.target.value
- **Ngày:** 2026-06-30
- **Severity:** High
- **Feature liên quan:** Tất cả màn hình dùng `<DateInput>` — Upload Lịch đi hàng, Filter Lịch đi hàng, Bảng điều phối xe
- **Triệu chứng:** Không thể chọn ngày trong DateInput — click vào calendar picker không cập nhật giá trị.
- **Root cause:** Commit `f4309cb` thay native `<input type="date">` bằng custom `<DateInput>` component (Việt hóa calendar). Native input gọi `onChange(e)` với `e.target.value = "2026-06-30"`. DateInput mới gọi `onChange("2026-06-30")` (string trực tiếp). Nhưng callers vẫn dùng pattern `(e) => setXxx(e.target.value)` → `e` là string, `.target.value` = `undefined` → không cập nhật.
- **Fix:** Sửa 3 file callers (UploadDeliveryScheduleModal, DeliveryScheduleFilters, SchedulePage) từ `onChange={(e) => setXxx(e.target.value)}` → `onChange={(value) => setXxx(value)}`. Các file dùng react-hook-form (`{...register}`, `field.onChange`) không bị ảnh hưởng vì react-hook-form fallback `e?.target?.value ?? e` xử lý được string trực tiếp.
- **File sửa:** `UploadDeliveryScheduleModal.tsx`, `DeliveryScheduleFilters.tsx`, `SchedulePage.tsx`
- **Cần chú ý:** Khi thay đổi signature của component prop (đặc biệt onChange), phải kiểm tra TẤT CẢ callers. Custom component không nên mô phỏng event object — nếu onChange trả trực tiếp value thì callers cũng phải nhận trực tiếp value.

### N+1 INSERT trong upload lịch đi hàng — 53s cho ~3000 rows
- **Ngày:** 2026-06-30
- **Severity:** Critical
- **Feature liên quan:** Lịch đi hàng — Upload Excel
- **Triệu chứng:** `POST /api/delivery-schedules/upload` mất 53,490ms để upload 1 tháng dữ liệu (~3000 rows). GET list chỉ 373ms.
- **Root cause:** `upload()` method dùng `for (const row of rowsToInsert) { await client.query(INSERT ...) }` — mỗi dòng 1 INSERT riêng lẻ, mỗi lần 1 network round trip. ~3000 dòng = ~3000 round trips = ~52s.
- **Fix:** Thay bằng multi-row INSERT batch 500 rows/lần. Từ `INSERT INTO ... VALUES ($1,$2,...)` trong loop → `INSERT INTO ... VALUES ($1,$2,...), ($10,$11,...), ...` gộp nhiều dòng trong 1 query. Giảm từ ~3000 queries xuống còn ~6 queries.
- **File sửa:** `backend/src/services/deliveryScheduleService.ts` — dòng 133-160 (upload method, batch insert)
- **Kết quả:** 53,000ms → ~500ms (-99%)
- **Cần chú ý:** Khi INSERT hàng loạt, luôn dùng multi-row INSERT hoặc COPY. Không bao giờ INSERT từng dòng trong loop. Batch size 500-1000 an toàn dưới PostgreSQL param limit (65535).

---

## Anti-patterns Tránh Lặp Lại

### 1. Không để import ở dưới cùng file
Luôn đặt tất cả imports ở trên cùng. Dùng named imports thay vì namespace import (`import React from 'react'` → `import { useState } from 'react'`).

### 2. Không dùng createBrowserRouter khi có React Context
`createBrowserRouter` không tương thích với `createContext`. Dùng `<BrowserRouter>` JSX.

### 3. Không mix concerns trong một component
AuthProvider = state only. Navigation = page level. Validation = form library. Không nhét mọi thứ vào một chỗ.

### 4. Không trust agent-generated imports path
Luôn verify import paths đúng sau khi scaffold, đặc biệt với nested folder structures.

### 5. Không cache .env
Vite không hot-reload `.env` khi dev server đang chạy. Phải restart `npm run dev` sau khi sửa `.env`.

## Setup Improvements Cần Làm

- [ ] Thêm ESLint + Prettier cho cả backend và frontend
- [ ] Thêm shared types package hoặc script export types từ backend sang frontend
- [ ] Cấu hình path alias (`@/` → `src/`) cho import ngắn hơn
- [ ] Thêm `.env.example` đầy đủ cho cả backend và frontend
- [ ] Setup Pre-commit hook (husky + lint-staged)

---

## Perf: N+1 INSERT pattern in create/update methods
- **Ngày:** 2026-07-21
- **Feature:** Lịch sử sửa xe (`repairService`)
- **Vấn đề:** Loop item dùng INSERT riêng lẻ → N roundtrips DB (mỗi item 1 query)
- **Fix:** Dùng multi-row INSERT — gộp tất cả items vào 1 query với dynamic placeholders `($1,$2,$3,$4), ($5,$6,$7,$8), ...`
- **Pattern:** Khi insert array of child records, luôn dùng batch INSERT thay vì loop. Áp dụng cho cả `create()` và `update()`.
- **Files:** `backend/src/services/repairService.ts:223-234, 294-310`

## Perf: Sequential queries instead of parallel
- **Ngày:** 2026-07-21
- **Feature:** Lịch sử sửa xe (`repairService.getById`)
- **Vấn đề:** 3 queries (record, items, images) chạy tuần tự → tổng latency = sum
- **Fix:** `Promise.all([query1, query2, query3])` → 3 queries song song, latency = max
- **Pattern:** Khi nhiều queries độc lập (không phụ thuộc kết quả của nhau), luôn dùng Promise.all.
- **Files:** `backend/src/services/repairService.ts:185-205`

## Perf: Missing composite index for DISTINCT ON query
- **Ngày:** 2026-07-21
- **Feature:** Lịch sử sửa xe (`repairService.getSummary`)
- **Vấn đề:** CTE `DISTINCT ON (vehicle_id) ORDER BY vehicle_id, repair_date DESC` chỉ có index trên `vehicle_id`, thiếu `repair_date DESC`
- **Fix:** Composite partial index `(vehicle_id, repair_date DESC) WHERE status = 'active'`
- **Pattern:** Khi dùng DISTINCT ON kèm ORDER BY nhiều cột, cần composite index khớp với cả DISTINCT và ORDER BY columns.
- **Files:** `backend/src/migrations/038_repair_composite_index.sql`

## Perf: Separate COUNT query when COUNT(*) OVER() available
- **Ngày:** 2026-07-21
- **Feature:** Lịch sử sửa xe (`repairService.listByVehicle`)
- **Vấn đề:** Chạy `SELECT COUNT(*)` riêng trước khi `SELECT data` → 2 roundtrips
- **Fix:** Gộp thành 1 query với `COUNT(*) OVER()::int AS total_count`
- **Pattern:** Paginated list queries nên dùng `COUNT(*) OVER()` để lấy total trong cùng 1 query.
- **Files:** `backend/src/services/repairService.ts:159-178`

## Change: Bảng điều phối xe — Chuẩn hóa biển số xe theo định dạng XXYXXXXX trước khi lưu
- **Ngày:** 2026-09-11
- **Severity:** Medium
- **Feature liên quan:** Bảng điều phối xe (`dispatchScheduleService`)
- **Thay đổi:** Thêm hàm `normalizePlateNumber()` biến đổi biển số xe về dạng chuẩn `xxyxxxxx` (ví dụ `51C 81056` → `51C81056`, `50H-55116` → `50H55116`, `50H 63174\u00a0` → `50H63174`) trước khi thực hiện INSERT đơn lẻ hoặc Batch insert vào DB `dispatch_schedules`.
- **Files:** `backend/src/services/dispatchScheduleService.ts`, `frontend/src/components/dispatch/ImportDispatchExcelModal.tsx`, `backend/src/__tests__/dispatchScheduleService.test.ts`.
- **Cần chú ý:** Format chuẩn hóa đồng nhất với bảng `vehicles` và `driver_invoices` (không chứa dấu cách, dấu gạch nối hay ký tự ẩn).

## Change: Xử lý Data Gạo — Đổi master data từ delivery_schedules sang driver_invoices
- **Ngày:** 2026-08-19
- **Feature:** Xử lý Data Gạo (RiceDeliveryDataPage)
- **Thay đổi:** Bước 2 fetch master data từ bảng `driver_invoices` (Hóa đơn tài xế) thay vì `delivery_schedules` (Lịch đi hàng)
- **Lý do:** Yêu cầu nghiệp vụ mới — so khớp với hóa đơn tài xế thay vì lịch đi hàng
- **Files sửa:**
  - `frontend/src/api/riceDeliveryApi.ts` — đổi endpoint `/delivery-schedules` → `/driver-invoices`, params `from_date/to_date` → `ngay_from/ngay_to`, map response format
  - `frontend/src/pages/admin/RiceDeliveryDataPage.tsx` — đổi text "lịch đi hàng" → "hóa đơn tài xế"
  - `frontend/src/utils/processRiceData.ts` — update comments
- **Không cần sửa BE:** `driverInvoiceService.list()` đã hỗ trợ filter `ngay_from/ngay_to` + pagination
- **Cần chú ý:** 2 API có response format khác nhau — `/delivery-schedules` trả `{ schedules, meta }`, `/driver-invoices` trả `{ data, pagination }`. Khi tái sử dụng API, kiểm tra kỹ response shape.

## Change: Xóa chức năng "Lịch đi hàng" (Delivery Schedules)
- **Ngày:** 2026-08-19
- **Feature:** Lịch đi hàng (delivery_schedules)
- **Thay đổi:** Xóa toàn bộ chức năng "Lịch đi hàng" — BE, FE, routes, sidebar, dashboard KPIs
- **Lý do:** Chức năng "Xử lý Data Gạo" đã chuyển sang dùng `driver_invoices` làm master data. Không còn use case nào sử dụng `delivery_schedules`.
- **Files xóa:**
  - BE: `deliveryScheduleService.ts`, `deliveryScheduleController.ts`, `routes/deliverySchedule.ts`
  - FE: `DeliverySchedulePage.tsx`, `deliveryScheduleApi.ts`, 9 components trong `delivery-schedule/`
- **Files sửa:**
  - `backend/src/routes/index.ts` — remove route mount
  - `backend/src/services/dashboardService.ts` — Overview: remove `trip_count` KPI; Operations: thay bằng `driver_invoices` stats
  - `frontend/src/Router.tsx` — remove route
  - `frontend/src/layouts/MainLayout.tsx` — remove sidebar item
  - `frontend/src/pages/admin/AuditLogPage.tsx` — remove label
  - `frontend/src/pages/dashboard/tabs/OverviewTab.tsx` — remove trip_count KPI card
  - `frontend/src/pages/dashboard/tabs/OperationsTab.tsx` — đơn giản hóa, chỉ hiển thị driver_invoices stats
  - `frontend/src/types/dashboard.ts` — update types
- **Migration:** `043_drop_delivery_schedules.sql` — DROP TABLE `delivery_schedules`
- **Cần chú ý:**
  - Migration DROP TABLE sẽ mất data vĩnh viễn — backup trước khi chạy
  - Audit log cũ có `entity_type = 'delivery_schedule'` vẫn hiển thị, fallback về raw value
  - Dashboard Operations tab đổi tên từ "Vận tải" thành "Hóa đơn tài xế" (chỉ hiển thị driver_invoices stats)
