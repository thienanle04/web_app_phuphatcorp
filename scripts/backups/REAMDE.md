backup:
pg_dump --dbname="postgresql://phuphat:phuphat_dev@localhost:5433/phuphatcorp_dev" -Fc --no-owner --no-acl -f scripts/backups/local.dump

restore:
pg_restore --dbname="postgresql://phuphat:phuphat_dev@localhost:5433/phuphatcorp_dev" --clean --if-exists scripts/backups/local.dump


feature/route-pricing:

Includes `price_books` (scope master). Dump `price_books` trước các bảng con vì FK.

backup:
pg_dump --dbname="postgresql://phuphat:phuphat_dev@localhost:5433/phuphatcorp_dev" -Fc --no-owner --no-acl -t price_books -t route_pricing_adjustment_periods -t delivery_routes -t route_groups -t route_group_members -t route_price_configs -t route_price_versions -t route_price_tiers -f scripts/backups/route-pricing.dump

restore:
pg_restore --dbname="postgresql://phuphat:phuphat_dev@localhost:5433/phuphatcorp_dev" --clean --if-exists scripts/backups/route-pricing.dump
