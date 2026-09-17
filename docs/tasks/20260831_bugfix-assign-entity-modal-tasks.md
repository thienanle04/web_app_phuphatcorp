# Task List: Bug Fix AssignEntityModal vehicles.map Error

**Ngày:** 2026-08-31
**Bug:** `TypeError: vehicles.map is not a function` in `AssignEntityModal.tsx`

---

## 🎨 FRONTEND TASKS

| ID | Task | Chi tiết kỹ thuật | Effort |
|---|---|---|---|
| BFE-01 | Sửa queryFn trích xuất `vehicles` array trong `AssignEntityModal.tsx` | Cập nhật endpoint call `/vehicles?limit=200` và trích xuất đúng mảng `res.data.data?.vehicles \|\| []`. Thêm type safety và fallback mảng rỗng | XS |
| BFE-02 | Kiểm tra `availableEntities` và `selectedEntityIds` handling | Đảm bảo `availableEntities` luôn là array `Array.isArray(availableEntities) ? availableEntities : []` để phòng ngừa crash trong mọi tình huống | XS |

---

## 📊 Thứ tự thực hiện

1. Sửa file `frontend/src/components/admin/data-scope/AssignEntityModal.tsx`
2. Chạy `npm run typecheck && npm run build` ở frontend để kiểm tra biên dịch
3. Cập nhật `lessons-learned.md`
