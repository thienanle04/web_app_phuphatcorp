-- ============================================================
-- Migration 046: Manual adjust flags on route price versions/tiers
-- Idempotent
-- ============================================================

ALTER TABLE route_price_versions
  ADD COLUMN IF NOT EXISTS pallet_manual_adjusted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE route_price_tiers
  ADD COLUMN IF NOT EXISTS is_manual_adjusted BOOLEAN NOT NULL DEFAULT FALSE;
