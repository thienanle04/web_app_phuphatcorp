# Task List: Bugfix Role Permission and Workflow Authorization in Invoice Tracking
**Ngày:** 2026-09-02
**BA Doc:** docs/ba/20260901_workflow-configuration-analysis.md

---

## ⚙️ BACKEND TASKS

| ID   | Task | Chi tiết kỹ thuật | Effort |
|------|------|-------------------|--------|
| BBE-01 | Gắn `user_permissions` vào kết quả list của `invoiceTrackingService.list` | Khi trả danh sách tickets trong `invoiceTrackingService.list`, lặp qua và tính toán `user_permissions` tương ứng cho `currentUser` giống như `getById`. | S |
| BBE-02 | Điều chỉnh permissions cho vai trò Tài xế (`TAI_XE`) | Loại bỏ quyền `invoice_tracking.manage` khỏi vai trò TAI_XE trong DB và migration (vì quyền manage là dành cho dispatcher/admin/accountant để duyệt/yêu cầu bổ sung, tài xế chỉ cần upload theo quy trình). | S |

## 🎨 FRONTEND TASKS

| ID   | Task | Chi tiết kỹ thuật | Effort |
|------|------|-------------------|--------|
| BFE-01 | Kiểm tra quyền chặt chẽ trong `TicketDetailModal.tsx` | Sử dụng cờ `ticket.user_permissions` làm điều kiện quyết định hiển thị cho `canUpload`, `canFinish`, `canRequestSupplement`. Nếu chưa có cờ permissions, chỉ cho phép thực hiện khi người dùng thực sự có quyền (không tự động gán true cho review buttons). | S |

---

## 📊 Thứ tự thực hiện

Phase 4: BBE-01 → BBE-02 → BFE-01
Phase 5: Viết tests & Verify BE + FE
