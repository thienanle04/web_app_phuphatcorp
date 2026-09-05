-- ============================================================
-- Migration 034: Promo Items (Danh mục hàng khuyến mãi)
-- Date: 2026-08-12
-- Module: Quản lý danh mục
-- ============================================================

CREATE TABLE IF NOT EXISTS promo_items (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(100) NOT NULL,
  product_name    VARCHAR(255) NOT NULL,
  unit_weight_kg  NUMERIC(10,3) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'deactive')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_promo_items_code_active
  ON promo_items(code) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_promo_items_status ON promo_items(status);

DROP TRIGGER IF EXISTS update_promo_items_updated_at ON promo_items;
CREATE TRIGGER update_promo_items_updated_at
  BEFORE UPDATE ON promo_items
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
