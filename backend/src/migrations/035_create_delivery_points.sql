-- ============================================================
-- Migration 035: Delivery Points (Danh mục điểm nhận hàng)
-- Date: 2026-08-30
-- Module: Quản lý danh mục
-- ============================================================

CREATE TABLE IF NOT EXISTS delivery_points (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(100) NOT NULL,
  address         TEXT NOT NULL,
  notes           TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'deactive')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_points_code_active
  ON delivery_points(code) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_delivery_points_status ON delivery_points(status);

DROP TRIGGER IF EXISTS update_delivery_points_updated_at ON delivery_points;
CREATE TRIGGER update_delivery_points_updated_at
  BEFORE UPDATE ON delivery_points
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
