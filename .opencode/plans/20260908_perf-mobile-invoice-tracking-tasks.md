# Task List: Tối ưu hóa hiệu năng & độ trễ kết nối cho Mobile Client
**Ngày:** 2026-09-08
**Mục tiêu:** Khắc phục triệt để lỗi timeout, ngắt kết nối mạng và tối ưu hóa trải nghiệm tải dữ liệu phía Mobile mà không sửa đổi Backend.

---

## 🎨 FRONTEND TASKS (Flutter Mobile)

| ID | Task | Chi tiết kỹ thuật | Effort |
|---|---|---|---|
| MFE-01 | Tối ưu hóa Timeout và Interceptor (`ApiClient`) | Tăng `connectTimeout`, `receiveTimeout`, `sendTimeout` lên 45s để hỗ trợ mạng di động/remote DB latency. Đảm bảo async token injection không làm chặn luồng. | S |
| MFE-02 | Chuyển đổi Token Storage sang SharedPreferences | Dùng `SharedPreferences` cho việc lưu & đọc `access_token` để truy xuất ngay tức thì (0ms latency), loại bỏ nghẽn do Keychain lock. | S |
| MFE-03 | Tối ưu hóa Lazy Loading Tab (`HomeScreen`) | Chuyển đổi từ `IndexedStack` (khởi tạo và gọi API đồng thời cả 2 tab) sang render theo tab được chọn. Tab Theo dõi HĐ chỉ tải khi tài xế bấm vào. | S |
| MFE-04 | Hoàn thiện Error Parsing & User Feedback | Trích xuất chính xác thông báo lỗi từ server, phân biệt rõ lỗi Timeout / Network Error với hướng dẫn người dùng thử lại. | S |
