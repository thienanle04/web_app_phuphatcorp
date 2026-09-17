-- ============================================================
-- Migration 049: Data-Level Permission Framework
-- Date: 2026-08-31
-- Module: data_scopes
-- ============================================================

-- 1. Table feature_scopes: Registered features with data-level permissions
CREATE TABLE IF NOT EXISTS feature_scopes (
  id SERIAL PRIMARY KEY,
  feature_code VARCHAR(100) UNIQUE NOT NULL,
  feature_name VARCHAR(200) NOT NULL,
  module VARCHAR(50) NOT NULL,
  allowed_scope_types VARCHAR(50)[] NOT NULL,
  entity_types VARCHAR(50)[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table role_scope_configs: Scope configuration for Role x Feature
CREATE TABLE IF NOT EXISTS role_scope_configs (
  id SERIAL PRIMARY KEY,
  feature_code VARCHAR(100) NOT NULL REFERENCES feature_scopes(feature_code) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  scope_type VARCHAR(20) NOT NULL CHECK (scope_type IN ('all', 'owner', 'entity', 'none')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_role_scope_configs UNIQUE(feature_code, role_id)
);

-- 3. Table user_entity_scopes: Specific entity assignments for users
CREATE TABLE IF NOT EXISTS user_entity_scopes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_code VARCHAR(100) NOT NULL REFERENCES feature_scopes(feature_code) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_user_entity_scopes UNIQUE(user_id, feature_code, entity_type, entity_id)
);

-- Indexes for fast scope resolution
CREATE INDEX IF NOT EXISTS idx_role_scope_configs_lookup ON role_scope_configs(feature_code, role_id);
CREATE INDEX IF NOT EXISTS idx_user_entity_scopes_user_feature ON user_entity_scopes(user_id, feature_code);

-- 4. Seed Permissions for Data Scopes
INSERT INTO permissions (code, name, module, description) VALUES
  ('data_scopes.view', 'Xem cấu hình phạm vi dữ liệu', 'data_scopes', 'Xem ma trận phạm vi dữ liệu theo vai trò và người dùng'),
  ('data_scopes.manage', 'Quản lý phạm vi dữ liệu', 'data_scopes', 'Cấu hình phạm vi dữ liệu cho vai trò và gán đối tượng cho người dùng')
ON CONFLICT (code) DO NOTHING;

-- Grant permissions to ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'ADMIN'
  AND p.code IN ('data_scopes.view', 'data_scopes.manage')
ON CONFLICT DO NOTHING;

-- 5. Seed feature_scopes for invoice_tracking
INSERT INTO feature_scopes (feature_code, feature_name, module, allowed_scope_types, entity_types)
VALUES (
  'invoice_tracking',
  'Theo dõi hóa đơn',
  'dispatch',
  ARRAY['all', 'owner', 'entity', 'none'],
  ARRAY['driver', 'vehicle']
)
ON CONFLICT (feature_code) DO UPDATE SET
  allowed_scope_types = EXCLUDED.allowed_scope_types,
  entity_types = EXCLUDED.entity_types;

-- 6. Seed default role_scope_configs for invoice_tracking
INSERT INTO role_scope_configs (feature_code, role_id, scope_type)
SELECT 'invoice_tracking', r.id,
  CASE
    WHEN r.code = 'ADMIN' THEN 'all'
    WHEN r.code = 'ACCOUNTANT' THEN 'all'
    ELSE 'none'
  END
FROM roles r
ON CONFLICT (feature_code, role_id) DO NOTHING;
