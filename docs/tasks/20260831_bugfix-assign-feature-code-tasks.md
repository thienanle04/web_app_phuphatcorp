# Task List: Bug Fix AssignEntityModal selectedFeatureCode Sync

**Ngày:** 2026-08-31
**Bug:** Error "Vui lòng chọn tính năng" on submit in `AssignEntityModal.tsx`

---

## 🎨 FRONTEND TASKS

| ID | Task | Chi tiết kỹ thuật | Effort |
|---|---|---|---|
| BFE-01 | Đồng bộ state `selectedFeatureCode` & `selectedEntityType` khi `features` hoặc `isOpen` thay đổi | Thêm `useEffect` để auto-select feature hợp lệ đầu tiên khi modal mở ra hoặc khi `features` được nạp | XS |
| BFE-02 | Thêm option mặc định và reset state khi đóng/mở modal | Đảm bảo `selectedUserId`, `selectedEntityIds`, `error` được reset sạch sẽ mỗi khi modal mở mới | XS |

---

## 📊 Thứ tự thực hiện

1. Sửa file `frontend/src/components/admin/data-scope/AssignEntityModal.tsx`
2. Chạy `npm run typecheck && npm run build` ở frontend để kiểm tra biên dịch
3. Cập nhật `lessons-learned.md`
