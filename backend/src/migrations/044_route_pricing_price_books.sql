-- ============================================================
-- Migration 044: Route pricing scoped by price_books (not suppliers)
-- Idempotent: skip column swap if supplier_id already dropped.
-- ============================================================

CREATE TABLE IF NOT EXISTS price_books (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'deactive')),
  created_by  INTEGER REFERENCES users(id),
  updated_by  INTEGER REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_price_books_name_active
  ON price_books (lower(trim(name)))
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_price_books_status ON price_books(status);

DROP TRIGGER IF EXISTS update_price_books_updated_at ON price_books;
CREATE TRIGGER update_price_books_updated_at
  BEFORE UPDATE ON price_books
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'delivery_routes' AND column_name = 'supplier_id'
  ) THEN
    ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS price_book_id INTEGER REFERENCES price_books(id);
    ALTER TABLE route_groups ADD COLUMN IF NOT EXISTS price_book_id INTEGER REFERENCES price_books(id);

    INSERT INTO price_books (name, created_at, updated_at)
    SELECT LEFT(
      COALESCE(
        NULLIF(TRIM(COALESCE(s.supplier_code, '') || ' — ' || COALESCE(s.name, '')), ' — '),
        'Bảng giá #' || ids.supplier_id::text
      ),
      255
    ), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM (
      SELECT DISTINCT supplier_id FROM delivery_routes
      UNION
      SELECT DISTINCT supplier_id FROM route_groups
    ) ids
    LEFT JOIN suppliers s ON s.id = ids.supplier_id
    WHERE NOT EXISTS (
      SELECT 1 FROM price_books pb
      WHERE pb.status = 'active'
        AND lower(trim(pb.name)) = lower(trim(LEFT(
          COALESCE(
            NULLIF(TRIM(COALESCE(s.supplier_code, '') || ' — ' || COALESCE(s.name, '')), ' — '),
            'Bảng giá #' || ids.supplier_id::text
          ),
          255
        )))
    );

    UPDATE delivery_routes dr
    SET price_book_id = pb.id
    FROM suppliers s
    JOIN price_books pb
      ON pb.status = 'active'
     AND lower(trim(pb.name)) = lower(trim(LEFT(
          COALESCE(
            NULLIF(TRIM(COALESCE(s.supplier_code, '') || ' — ' || COALESCE(s.name, '')), ' — '),
            'Bảng giá #' || s.id::text
          ),
          255
        )))
    WHERE dr.supplier_id = s.id AND dr.price_book_id IS NULL;

    UPDATE delivery_routes dr
    SET price_book_id = pb.id
    FROM price_books pb
    WHERE dr.price_book_id IS NULL
      AND pb.status = 'active'
      AND lower(trim(pb.name)) = lower('Bảng giá #' || dr.supplier_id::text);

    UPDATE route_groups g
    SET price_book_id = pb.id
    FROM suppliers s
    JOIN price_books pb
      ON pb.status = 'active'
     AND lower(trim(pb.name)) = lower(trim(LEFT(
          COALESCE(
            NULLIF(TRIM(COALESCE(s.supplier_code, '') || ' — ' || COALESCE(s.name, '')), ' — '),
            'Bảng giá #' || s.id::text
          ),
          255
        )))
    WHERE g.supplier_id = s.id AND g.price_book_id IS NULL;

    UPDATE route_groups g
    SET price_book_id = pb.id
    FROM price_books pb
    WHERE g.price_book_id IS NULL
      AND pb.status = 'active'
      AND lower(trim(pb.name)) = lower('Bảng giá #' || g.supplier_id::text);

    -- Any leftover rows: one catch-all book
    IF EXISTS (
      SELECT 1 FROM delivery_routes WHERE price_book_id IS NULL
      UNION
      SELECT 1 FROM route_groups WHERE price_book_id IS NULL
    ) THEN
      INSERT INTO price_books (name)
      SELECT 'Bảng giá migrated'
      WHERE NOT EXISTS (
        SELECT 1 FROM price_books WHERE status = 'active' AND lower(trim(name)) = lower('Bảng giá migrated')
      );
      UPDATE delivery_routes SET price_book_id = (
        SELECT id FROM price_books WHERE status = 'active' AND lower(trim(name)) = lower('Bảng giá migrated') LIMIT 1
      ) WHERE price_book_id IS NULL;
      UPDATE route_groups SET price_book_id = (
        SELECT id FROM price_books WHERE status = 'active' AND lower(trim(name)) = lower('Bảng giá migrated') LIMIT 1
      ) WHERE price_book_id IS NULL;
    END IF;

    ALTER TABLE delivery_routes ALTER COLUMN price_book_id SET NOT NULL;
    ALTER TABLE route_groups ALTER COLUMN price_book_id SET NOT NULL;

    DROP INDEX IF EXISTS idx_delivery_routes_supplier;
    DROP INDEX IF EXISTS idx_delivery_routes_unique_active;
    DROP INDEX IF EXISTS idx_route_groups_supplier;
    DROP INDEX IF EXISTS idx_route_groups_residual_active_note;
    DROP INDEX IF EXISTS idx_route_groups_name_active;

    ALTER TABLE delivery_routes DROP COLUMN supplier_id;
    ALTER TABLE route_groups DROP COLUMN supplier_id;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_delivery_routes_price_book ON delivery_routes(price_book_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_routes_unique_active
  ON delivery_routes (
    price_book_id,
    province_code,
    COALESCE(ward_code, ''),
    COALESCE(location_text, ''),
    COALESCE(NULLIF(TRIM(note), ''), '')
  )
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_route_groups_price_book ON route_groups(price_book_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_route_groups_residual_active_note
  ON route_groups (
    price_book_id,
    province_code,
    COALESCE(NULLIF(TRIM(note), ''), '')
  )
  WHERE status = 'active' AND is_residual = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_route_groups_name_active
  ON route_groups(price_book_id, province_code, name) WHERE status = 'active';
