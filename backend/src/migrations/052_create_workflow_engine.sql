-- ============================================================
-- Migration 052: Create Workflow Engine & Seed Invoice Tracking Workflow
-- Date: 2026-09-01
-- Module: workflows
-- ============================================================

-- 1. Table workflows: Master workflow definitions per feature
CREATE TABLE IF NOT EXISTS workflows (
  id SERIAL PRIMARY KEY,
  feature_code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  module VARCHAR(50) NOT NULL DEFAULT 'dispatch',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table workflow_steps: Steps definition for each workflow
CREATE TABLE IF NOT EXISTS workflow_steps (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL DEFAULT 1,
  step_code VARCHAR(50) NOT NULL,
  step_name VARCHAR(100) NOT NULL,
  status_code VARCHAR(50) NOT NULL,
  allowed_actions VARCHAR(50)[] NOT NULL DEFAULT '{}',
  actor_type VARCHAR(20) NOT NULL DEFAULT 'role' CHECK (actor_type IN ('role', 'user', 'dynamic', 'any')),
  assigned_role_ids INTEGER[] DEFAULT '{}',
  assigned_user_ids INTEGER[] DEFAULT '{}',
  dynamic_actor VARCHAR(50) CHECK (dynamic_actor IS NULL OR dynamic_actor IN ('assigned_driver', 'creator', 'dispatcher')),
  is_initial BOOLEAN NOT NULL DEFAULT FALSE,
  is_final BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_workflow_step_code UNIQUE(workflow_id, step_code)
);

-- 3. Table workflow_transitions: Transition rules between steps
CREATE TABLE IF NOT EXISTS workflow_transitions (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  from_step_id INTEGER NOT NULL REFERENCES workflow_steps(id) ON DELETE CASCADE,
  to_step_id INTEGER NOT NULL REFERENCES workflow_steps(id) ON DELETE CASCADE,
  action_code VARCHAR(50) NOT NULL,
  action_name VARCHAR(100) NOT NULL,
  require_note BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow_id ON workflow_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_order ON workflow_steps(workflow_id, step_order);
CREATE INDEX IF NOT EXISTS idx_workflow_transitions_workflow ON workflow_transitions(workflow_id);

-- 4. Permissions for Workflows
INSERT INTO permissions (code, name, module, description) VALUES
  ('workflows.view', 'Xem cấu hình quy trình', 'workflows', 'Xem danh sách và chi tiết các bước quy trình động'),
  ('workflows.manage', 'Quản lý cấu hình quy trình', 'workflows', 'Bật/tắt, tạo mới, chỉnh sửa, đổi thứ tự các bước và phân quyền thao tác trong quy trình')
ON CONFLICT (code) DO NOTHING;

-- Grant permissions to ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'ADMIN'
  AND p.code IN ('workflows.view', 'workflows.manage')
ON CONFLICT DO NOTHING;

-- 5. Seed Workflow for invoice_tracking
INSERT INTO workflows (feature_code, name, description, module, is_active)
VALUES (
  'invoice_tracking',
  'Quy trình theo dõi hóa đơn',
  'Quản lý vòng đời chứng từ và hóa đơn từ lúc tạo chuyến, tải chứng từ đến khi hoàn tất kiểm tra duyệt',
  'dispatch',
  TRUE
)
ON CONFLICT (feature_code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  module = EXCLUDED.module;

-- Seed Steps for invoice_tracking
DO $$
DECLARE
  v_wf_id INTEGER;
  v_step_created_id INTEGER;
  v_step_pending_id INTEGER;
  v_step_req_id INTEGER;
  v_step_completed_id INTEGER;
  v_role_admin_id INTEGER;
  v_role_accountant_id INTEGER;
BEGIN
  SELECT id INTO v_wf_id FROM workflows WHERE feature_code = 'invoice_tracking';
  SELECT id INTO v_role_admin_id FROM roles WHERE code = 'ADMIN';
  SELECT id INTO v_role_accountant_id FROM roles WHERE code = 'ACCOUNTANT';

  -- Only seed if no steps exist yet
  IF NOT EXISTS (SELECT 1 FROM workflow_steps WHERE workflow_id = v_wf_id) THEN
    -- Step 1: Tạo mới chuyến
    INSERT INTO workflow_steps (
      workflow_id, step_order, step_code, step_name, status_code,
      allowed_actions, actor_type, dynamic_actor, assigned_role_ids, is_initial, is_final
    ) VALUES (
      v_wf_id, 1, 'STEP_CREATED', 'Tạo mới & Chờ tải chứng từ', 'created',
      ARRAY['upload_document'], 'dynamic', 'assigned_driver',
      CASE WHEN v_role_admin_id IS NOT NULL THEN ARRAY[v_role_admin_id] ELSE '{}'::INTEGER[] END,
      TRUE, FALSE
    ) RETURNING id INTO v_step_created_id;

    -- Step 2: Chờ duyệt chứng từ
    INSERT INTO workflow_steps (
      workflow_id, step_order, step_code, step_name, status_code,
      allowed_actions, actor_type, assigned_role_ids, is_initial, is_final
    ) VALUES (
      v_wf_id, 2, 'STEP_PENDING_REVIEW', 'Chờ duyệt chứng từ', 'pending_review',
      ARRAY['review_finish', 'request_supplement'], 'role',
      ARRAY[COALESCE(v_role_admin_id, 1), COALESCE(v_role_accountant_id, 2)],
      FALSE, FALSE
    ) RETURNING id INTO v_step_pending_id;

    -- Step 3: Yêu cầu bổ sung chứng từ
    INSERT INTO workflow_steps (
      workflow_id, step_order, step_code, step_name, status_code,
      allowed_actions, actor_type, dynamic_actor, assigned_role_ids, is_initial, is_final
    ) VALUES (
      v_wf_id, 3, 'STEP_REQUEST_SUPPLEMENT', 'Yêu cầu bổ sung chứng từ', 'request_supplement',
      ARRAY['upload_document'], 'dynamic', 'assigned_driver',
      CASE WHEN v_role_admin_id IS NOT NULL THEN ARRAY[v_role_admin_id] ELSE '{}'::INTEGER[] END,
      FALSE, FALSE
    ) RETURNING id INTO v_step_req_id;

    -- Step 4: Hoàn thành
    INSERT INTO workflow_steps (
      workflow_id, step_order, step_code, step_name, status_code,
      allowed_actions, actor_type, is_initial, is_final
    ) VALUES (
      v_wf_id, 4, 'STEP_COMPLETED', 'Hoàn tất chứng từ', 'completed',
      '{}'::VARCHAR[], 'role',
      FALSE, TRUE
    ) RETURNING id INTO v_step_completed_id;

    -- Transitions
    -- 1. Created -> Pending Review (action: upload_document)
    INSERT INTO workflow_transitions (workflow_id, from_step_id, to_step_id, action_code, action_name, require_note)
    VALUES (v_wf_id, v_step_created_id, v_step_pending_id, 'upload_document', 'Tải chứng từ', FALSE);

    -- 2. Pending Review -> Completed (action: review_finish)
    INSERT INTO workflow_transitions (workflow_id, from_step_id, to_step_id, action_code, action_name, require_note)
    VALUES (v_wf_id, v_step_pending_id, v_step_completed_id, 'review_finish', 'Duyệt hoàn thành', FALSE);

    -- 3. Pending Review -> Request Supplement (action: request_supplement)
    INSERT INTO workflow_transitions (workflow_id, from_step_id, to_step_id, action_code, action_name, require_note)
    VALUES (v_wf_id, v_step_pending_id, v_step_req_id, 'request_supplement', 'Yêu cầu bổ sung', TRUE);

    -- 4. Request Supplement -> Pending Review (action: upload_document)
    INSERT INTO workflow_transitions (workflow_id, from_step_id, to_step_id, action_code, action_name, require_note)
    VALUES (v_wf_id, v_step_req_id, v_step_pending_id, 'upload_document', 'Bổ sung chứng từ', FALSE);
  END IF;
END $$;
