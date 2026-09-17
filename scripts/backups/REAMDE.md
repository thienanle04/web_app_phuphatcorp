backup:
pg_dump --dbname="postgresql://phuphat:phuphat_dev@localhost:5433/phuphatcorp_dev" -Fc --no-owner --no-acl -f scripts/backups/local.dump

restore:
pg_restore --dbname="postgresql://phuphat:phuphat_dev@localhost:5433/phuphatcorp_dev" --clean --if-exists scripts/backups/local.dump


feature/route-pricing:

Includes `price_books` (scope master) và `price_sets` (catalog bộ giá). Dump cha trước con vì FK:
`price_books` → tuyến/nhóm; `price_sets` → `price_set_tiers` → `route_price_tiers`;
`route_price_configs.price_set_id` trỏ `price_sets`.

backup:
pg_dump --dbname="postgresql://phuphat:phuphat_dev@localhost:5433/phuphatcorp_dev" -Fc --no-owner --no-acl `
  -t price_books `
  -t price_sets `
  -t price_set_tiers `
  -t route_pricing_adjustment_periods `
  -t delivery_routes `
  -t route_groups `
  -t route_group_members `
  -t route_price_configs `
  -t route_price_versions `
  -t route_price_tiers `
  -f scripts/backups/route-pricing.dump

restore:
pg_restore --dbname="postgresql://phuphat:phuphat_dev@localhost:5433/phuphatcorp_dev" --clean --if-exists scripts/backups/route-pricing.dump

Xóa dữ liệu record:
psql "postgresql://phuphat:phuphat_dev@localhost:5433/phuphatcorp_dev" -v ON_ERROR_STOP=1 -c "BEGIN; TRUNCATE TABLE route_price_tiers, route_price_versions, route_price_configs, route_group_members, route_groups, delivery_routes, price_set_tiers, price_sets, price_books RESTART IDENTITY; COMMIT; SELECT 'price_books' AS t, count(*) FROM price_books UNION ALL SELECT 'price_sets', count(*) FROM price_sets UNION ALL SELECT 'price_set_tiers', count(*) FROM price_set_tiers UNION ALL SELECT 'delivery_routes', count(*) FROM delivery_routes UNION ALL SELECT 'route_groups', count(*) FROM route_groups UNION ALL SELECT 'route_group_members', count(*) FROM route_group_members UNION ALL SELECT 'route_price_configs', count(*) FROM route_price_configs UNION ALL SELECT 'route_price_versions', count(*) FROM route_price_versions UNION ALL SELECT 'route_price_tiers', count(*) FROM route_price_tiers UNION ALL SELECT 'adjustment_periods', count(*) FROM route_pricing_adjustment_periods;"