-- ============================================================
-- Migration 050: Cleanup obsolete transport permissions
-- Date: 2026-08-31
-- Mô tả: Xóa các permission thừa transport.view và transport.manage
--         đã được thay thế bởi vehicle_data.*, fuel.*, catalog.*, dispatch.*
-- ============================================================

DELETE FROM role_permissions
WHERE permission_id IN (
  SELECT id FROM permissions WHERE code IN ('transport.view', 'transport.manage')
);

DELETE FROM permissions
WHERE code IN ('transport.view', 'transport.manage');
