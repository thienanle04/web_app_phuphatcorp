-- Optional: đảm bảo bảng giá CLF tồn tại trước seed-clf-f.
-- Seed TS đã find-or-create; file này dùng khi chạy psql tay.
-- created_by / updated_by = 19

INSERT INTO price_books (name, created_by, updated_by)
SELECT 'CLF', 19, 19
WHERE NOT EXISTS (
  SELECT 1
  FROM price_books
  WHERE status = 'active'
    AND lower(trim(name)) = lower('CLF')
);
