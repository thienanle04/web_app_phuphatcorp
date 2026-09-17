-- ============================================================
-- Migration 051: Add invoice tracking permissions
-- Date: 2026-08-31
-- Module: invoice_tracking
-- ============================================================

INSERT INTO permissions (code, name, module, description) VALUES
  ('invoice_tracking.view',   'Xem theo dõi hóa đơn',     'invoice_tracking', 'Xem danh sách và chi tiết ticket theo dõi chứng từ hóa đơn'),
  ('invoice_tracking.manage', 'Quản lý theo dõi hóa đơn', 'invoice_tracking', 'Upload, duyệt và yêu cầu bổ sung chứng từ hóa đơn')
ON CONFLICT (code) DO NOTHING;

-- ADMIN: cả hai
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'ADMIN'
  AND p.code IN ('invoice_tracking.view', 'invoice_tracking.manage')
ON CONFLICT DO NOTHING;

-- ACCOUNTANT: cả hai
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'ACCOUNTANT'
  AND p.code IN ('invoice_tracking.view', 'invoice_tracking.manage')
ON CONFLICT DO NOTHING;

-- VIEWER: chỉ view
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'VIEWER'
  AND p.code IN ('invoice_tracking.view')
ON CONFLICT DO NOTHING;
