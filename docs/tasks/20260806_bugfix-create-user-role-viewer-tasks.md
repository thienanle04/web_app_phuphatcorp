# Task List: Bugfix — Create user luôn nhận role VIEWER
**Ngày:** 2026-08-06  
**Bug:** Tạo user chọn role bất kỳ nhưng `users.role` luôn VIEWER  
**Severity:** High

---

## ⚙️ BACKEND TASKS

| ID | Task | Chi tiết kỹ thuật | Effort |
|----|------|-------------------|--------|
| BBE-01 | Sync `users.role` từ `roles.code` khi create với `role_id` | `userService.createUser`: khi có `resolvedRoleId`, lấy `code` từ roles (cùng query validate) gán vào cột legacy `role` — giống `updateUser`. Fallback `data.role \|\| VIEWER` chỉ khi không có role_id | S |
| BBE-02 | Regression unit test | `userService.createUser` với `role_id` = ACCOUNTANT → INSERT args có `role = 'ACCOUNTANT'` và đúng `role_id` | S |

## 🎨 FRONTEND TASKS

| ID | Task | Chi tiết | Effort |
|----|------|----------|--------|
| — | Không cần | FE đã gửi đúng `role_id` | — |

## 📊 Thứ tự

BBE-01 → BBE-02 → Document lessons-learned

## ⚠️ Lưu ý

- Không đổi FE / schema / API contract
- `updateUser` đã sync đúng — mirror pattern đó ở create
- Cột `role` (VARCHAR) vẫn dùng cho UI badge + `authorizeRoles`; `role_id` dùng cho RBAC permissions
