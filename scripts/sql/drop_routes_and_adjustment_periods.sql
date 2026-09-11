-- Xóa toàn bộ tuyến + giá tuyến + kỳ điều chỉnh.
-- Giữ price_books (MCC (tt), CLF, …) để seed lại.
--
-- Backup trước (xem scripts/backups/REAMDE.md):
--   pg_dump --dbname="postgresql://phuphat:phuphat_dev@localhost:5433/phuphatcorp_dev" -Fc --no-owner --no-acl \
--     -t price_books -t route_pricing_adjustment_periods -t delivery_routes -t route_groups \
--     -t route_group_members -t route_price_configs -t route_price_versions -t route_price_tiers \
--     -f scripts/backups/route-pricing.dump
--
-- Sau khi chạy:
--   1) npm run seed:adjustment-periods
--   2) seed F sheet (vd. npm run seed:mcc-tt-f)
--   3) npm run cascade:route-pricing
--
-- psql -h localhost -p 5433 -U phuphat -d phuphatcorp_dev \
--   -f scripts/sql/drop_routes_and_adjustment_periods.sql

BEGIN;

DO $$
DECLARE
  n_tiers INTEGER;
  n_versions INTEGER;
  n_configs INTEGER;
  n_members INTEGER;
  n_groups INTEGER;
  n_routes INTEGER;
  n_periods INTEGER;
BEGIN
  SELECT COUNT(*) INTO n_tiers FROM route_price_tiers;
  SELECT COUNT(*) INTO n_versions FROM route_price_versions;
  SELECT COUNT(*) INTO n_configs FROM route_price_configs;
  SELECT COUNT(*) INTO n_members FROM route_group_members;
  SELECT COUNT(*) INTO n_groups FROM route_groups;
  SELECT COUNT(*) INTO n_routes FROM delivery_routes;
  SELECT COUNT(*) INTO n_periods FROM route_pricing_adjustment_periods;

  RAISE NOTICE 'drop_routes_and_adjustment_periods: tiers=% versions=% configs=% members=% groups=% routes=% periods=%',
    n_tiers, n_versions, n_configs, n_members, n_groups, n_routes, n_periods;
END $$;

-- Một lệnh: phá FK vòng (base_version_id) + period FK; reset SERIAL.
TRUNCATE TABLE
  route_price_tiers,
  route_price_versions,
  route_price_configs,
  route_group_members,
  route_groups,
  delivery_routes,
  route_pricing_adjustment_periods
RESTART IDENTITY;

COMMIT;
