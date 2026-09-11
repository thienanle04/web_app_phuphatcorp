-- Cascade route_price_versions từ bảng giá gốc sang các kỳ điều chỉnh sau.
-- Mirror BE createAbsolutePrice / updateAbsolutePrice cascade:
--   mỗi kỳ sau = scale % từ version kỳ liền trước (round nghìn), base_version_id = prev.
--
-- Không filter theo NCC — cascade mọi config thuộc mọi price_books.
--
-- Chạy SAU khi đã có:
--   1) route_pricing_adjustment_periods (vd. seed_adjustment_periods.sql)
--   2) ≥1 version gốc (base_version_id IS NULL) trên route_price_configs
--
-- Idempotent: bỏ qua (config, period) đã có version; tiếp tục chain từ version đó.
-- KHÔNG tạo absolute mới — chỉ fill kỳ thiếu.
--
-- Prefer: npx tsx scripts/cascade-route-pricing-versions.ts  (or npm run cascade:route-pricing)
--
-- psql -h localhost -p 5433 -U phuphat -d phuphatcorp_dev \
--   -f scripts/sql/cascade_route_pricing_versions.sql

BEGIN;

DO $$
DECLARE
  abs_rec RECORD;
  per_rec RECORD;
  prev_id INTEGER;
  prev_pallet NUMERIC;
  new_id INTEGER;
  factor NUMERIC;
  existing_id INTEGER;
  existing_pallet NUMERIC;
  created_count INTEGER := 0;
BEGIN
  FOR abs_rec IN
    SELECT
      v.id,
      v.price_config_id,
      v.pricing_mode,
      v.pallet_trip_price,
      v.created_by,
      p.start_date AS base_start
    FROM route_price_versions v
    JOIN route_pricing_adjustment_periods p ON p.id = v.adjustment_period_id
    WHERE v.base_version_id IS NULL
    ORDER BY v.price_config_id, p.start_date
  LOOP
    prev_id := abs_rec.id;
    prev_pallet := abs_rec.pallet_trip_price;

    FOR per_rec IN
      SELECT id, start_date, percent
      FROM route_pricing_adjustment_periods
      WHERE start_date > abs_rec.base_start
      ORDER BY start_date ASC
    LOOP
      SELECT v.id, v.pallet_trip_price
        INTO existing_id, existing_pallet
      FROM route_price_versions v
      WHERE v.price_config_id = abs_rec.price_config_id
        AND v.adjustment_period_id = per_rec.id;

      IF FOUND THEN
        prev_id := existing_id;
        prev_pallet := existing_pallet;
        CONTINUE;
      END IF;

      factor := 1 + (per_rec.percent / 100.0);

      INSERT INTO route_price_versions (
        price_config_id,
        pricing_mode,
        pallet_trip_price,
        base_version_id,
        adjustment_period_id,
        created_by
      ) VALUES (
        abs_rec.price_config_id,
        abs_rec.pricing_mode,
        ROUND(prev_pallet * factor / 1000.0) * 1000,
        prev_id,
        per_rec.id,
        abs_rec.created_by
      )
      RETURNING id INTO new_id;

      INSERT INTO route_price_tiers (
        price_version_id,
        range_from,
        range_to,
        pricing_unit,
        price,
        min_billable_ton,
        sort_order
      )
      SELECT
        new_id,
        t.range_from,
        t.range_to,
        t.pricing_unit,
        ROUND(t.price * factor / 1000.0) * 1000,
        t.min_billable_ton,
        t.sort_order
      FROM route_price_tiers t
      WHERE t.price_version_id = prev_id
      ORDER BY t.sort_order, t.range_from;

      prev_id := new_id;
      prev_pallet := ROUND(prev_pallet * factor / 1000.0) * 1000;
      created_count := created_count + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'cascade_route_pricing_versions: created % version(s)', created_count;
END $$;

COMMIT;
