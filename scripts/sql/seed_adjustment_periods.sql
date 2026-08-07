-- Seed Kỳ điều chỉnh from BẢNG GIÁ - 2026 - 1.8.2026.xlsx (sheet "Kỳ điều chỉnh")
-- Prefer: npx tsx scripts/seed-adjustment-periods.ts  (or npm run seed:adjustment-periods)
-- SQL source kept for psql / review.
--
-- NOTE: idx_rp_adj_periods_one_open allows only ONE row with end_date IS NULL.
--        Insert with end_date already chained (only latest = NULL).
-- created_by / updated_by = 19

BEGIN;

INSERT INTO route_pricing_adjustment_periods (start_date, end_date, percent, note, created_by, updated_by)
VALUES
  ('2026-01-01', '2026-03-01', -3.8,  'giá dầu 17,250', 19, 19),
  ('2026-03-01', '2026-03-06',  4.68, 'giá dầu 19,270', 19, 19),
  ('2026-03-06', '2026-03-08',  7.8,  'giá dầu 23,030', 19, 19),
  ('2026-03-08', '2026-03-12', 12.51, 'giá dầu 30,230', 19, 19),
  ('2026-03-12', '2026-03-20', -4.98, 'giá dầu 26,470', 19, 19),
  ('2026-03-20', '2026-03-25', 10.5,  'giá dầu 33,420', 19, 19),
  ('2026-03-25', '2026-03-26',  7.5,  'giá dầu 39,660', 19, 19),
  ('2026-03-26', '2026-03-27', -1.79, 'giá dầu 37,890', 19, 19),
  ('2026-03-27', '2026-04-03', -2.59, 'giá dầu 35,440', 19, 19),
  ('2026-04-03', '2026-04-04',  6.07, 'giá dầu 40,820', 19, 19),
  ('2026-04-04', '2026-04-09',  3.88, 'giá dầu 44,780', 19, 19),
  ('2026-04-09', '2026-04-10', -1.73, 'giá dầu 42,840', 19, 19),
  ('2026-04-10', '2026-04-16', -9.23, 'giá dầu 32,960', 19, 19),
  ('2026-04-16', '2026-04-22', -2.33, 'giá dầu 31,040', 19, 19),
  ('2026-04-22', '2026-04-24', -4.11, 'giá dầu 27,850', 19, 19),
  ('2026-04-24', '2026-04-30', -1.67, 'giá dầu 26,470', 19, 19),
  ('2026-04-30', '2026-06-19',  2.22, 'giá dầu 28,170', 19, 19),
  ('2026-06-19', '2026-07-01', -6.59, 'giá dầu 23,530', 19, 19),
  ('2026-07-01', '2026-07-24', -2.84, 'giá dầu 21,860', 19, 19),
  ('2026-07-24', '2026-08-01',  7.14, 'giá dầu 25,760', 19, 19),
  ('2026-08-01', NULL,           2.89, 'giá dầu 27,620', 19, 19)
ON CONFLICT (start_date) DO UPDATE SET
  end_date   = EXCLUDED.end_date,
  percent    = EXCLUDED.percent,
  note       = EXCLUDED.note,
  updated_by = EXCLUDED.updated_by,
  updated_at = CURRENT_TIMESTAMP;

WITH ordered AS (
  SELECT
    id,
    LEAD(start_date) OVER (ORDER BY start_date ASC) AS next_start
  FROM route_pricing_adjustment_periods
)
UPDATE route_pricing_adjustment_periods p
SET
  end_date   = o.next_start,
  updated_at = CURRENT_TIMESTAMP
FROM ordered o
WHERE p.id = o.id;

COMMIT;
