# Task List: Bugfix CORS Preflight for Flutter Web & Dynamic Localhost Ports
**Ngày:** 2026-09-08
**Bug:** Flutter Web / Dev servers chạy dynamic port (vd: `http://localhost:53734`) bị Backend chặn CORS

---

## ⚙️ BACKEND TASKS

| ID | Task | Chi tiết kỹ thuật | Effort |
|---|---|---|---|
| BBE-01 | Cập nhật CORS Middleware | Trong `backend/src/app.ts`: cho phép regex matching bất kỳ localhost port nào (`^http:\/\/(localhost\|127\.0\.0\.1)(:\d+)?$`) song song với whitelist production domains | S |
| BBE-02 | Viết Regression Test | Tạo test suite trong `backend/src/__tests__/cors.test.ts` kiểm tra các request từ các origin: localhost port bất kỳ, production domain, và origin trái phép | S |

## 📊 Thứ tự thực hiện
Phase 4: BBE-01
Phase 5: BBE-02 (Viết & chạy test)
Phase 6: Cập nhật `lessons-learned.md`
