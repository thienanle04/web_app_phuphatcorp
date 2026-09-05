# Task List: Bugfix — User Management hiện raw i18n key cho role
**Ngày:** 2026-08-06  
**Bug:** Badge role hiện `users.roles.IEU_PHOI_XE` thay vì tên vai trò  
**Severity:** Medium

---

## 🎨 FRONTEND TASKS

| ID | Task | Chi tiết kỹ thuật | Effort |
|----|------|-------------------|--------|
| BFE-01 | Helper `getUserRoleLabel` | Ưu tiên `role_name` từ API; fallback i18n nếu key tồn tại; else `role` code | S |
| BFE-02 | Sửa list + detail | `UserManagementPage`, `UserDetailModal` dùng helper thay `t(\`users.roles.${user.role}\`)` | S |
| BFE-03 | Regression | Unit assert helper: custom role → `role_name`; thiếu name + missing i18n → code; system role có i18n → bản dịch | S |

## ⚙️ BACKEND

| ID | Task | Chi tiết | Effort |
|----|------|----------|--------|
| — | Không cần | `getUsers` / `getUserById` đã JOIN `r.name AS role_name` | — |

## 📊 Thứ tự

BFE-01 → BFE-02 → BFE-03 → Document

## ⚠️ Lưu ý

- Không hardcode thêm role vào i18n — role động lấy từ DB `roles.name`
- Filter role trên list vẫn hardcode 3 enum (ngoài scope bug display này)
