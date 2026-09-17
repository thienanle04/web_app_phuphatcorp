-- ============================================================
-- Migration 055: Price sets (bộ giá) — schema only
-- Idempotent. Does not seed catalogs or backfill existing prices.
-- Fails if route_price_tiers already has rows (price_set_tier_id would be null).
-- ============================================================

CREATE TABLE IF NOT EXISTS price_sets (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  pricing_mode  VARCHAR(20) NOT NULL
                  CHECK (pricing_mode IN ('by_weight', 'by_trips', 'by_truck')),
  has_pallet    BOOLEAN NOT NULL DEFAULT FALSE,
  fingerprint   TEXT NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'deactive')),
  created_by    INTEGER REFERENCES users(id),
  updated_by    INTEGER REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_price_sets_name_active
  ON price_sets (lower(trim(name)))
  WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_price_sets_fingerprint_active
  ON price_sets (fingerprint)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_price_sets_status ON price_sets(status);

DROP TRIGGER IF EXISTS update_price_sets_updated_at ON price_sets;
CREATE TRIGGER update_price_sets_updated_at
  BEFORE UPDATE ON price_sets
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE IF NOT EXISTS price_set_tiers (
  id                SERIAL PRIMARY KEY,
  price_set_id      INTEGER NOT NULL REFERENCES price_sets(id),
  sort_order        INTEGER NOT NULL,
  range_from        NUMERIC(10,3),
  range_to          NUMERIC(10,3),
  pricing_unit      VARCHAR(10) NOT NULL CHECK (pricing_unit IN ('chuyen', 'tan')),
  min_billable_ton  NUMERIC(10,3),
  label             VARCHAR(255),
  UNIQUE (price_set_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_price_set_tiers_set ON price_set_tiers(price_set_id);

ALTER TABLE route_price_configs
  ADD COLUMN IF NOT EXISTS price_set_id INTEGER REFERENCES price_sets(id);

CREATE INDEX IF NOT EXISTS idx_route_price_configs_price_set
  ON route_price_configs(price_set_id);

ALTER TABLE route_price_tiers
  ADD COLUMN IF NOT EXISTS price_set_tier_id INTEGER REFERENCES price_set_tiers(id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM route_price_tiers WHERE price_set_tier_id IS NULL) THEN
    RAISE EXCEPTION '055 refuses existing route_price_tiers without price_set_tier_id. Clear prices first; this migration does not backfill.';
  END IF;
END $$;

ALTER TABLE route_price_tiers ALTER COLUMN price_set_tier_id SET NOT NULL;

ALTER TABLE route_price_versions
  ALTER COLUMN pallet_trip_price DROP NOT NULL;
