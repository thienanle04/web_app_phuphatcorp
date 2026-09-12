-- ============================================================
-- Migration 045: Route pricing mode by_truck + tier label
-- Idempotent
-- ============================================================

DO $$
DECLARE
  conname text;
BEGIN
  FOR conname IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'route_price_versions'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%pricing_mode%'
  LOOP
    EXECUTE format('ALTER TABLE route_price_versions DROP CONSTRAINT IF EXISTS %I', conname);
  END LOOP;
END $$;

ALTER TABLE route_price_versions
  ADD CONSTRAINT route_price_versions_pricing_mode_check
  CHECK (pricing_mode IN ('by_weight', 'by_trips', 'by_truck'));

ALTER TABLE route_price_tiers
  ADD COLUMN IF NOT EXISTS label VARCHAR(255) NULL;
