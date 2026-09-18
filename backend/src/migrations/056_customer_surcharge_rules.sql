-- ============================================================
-- Migration 056: Customer surcharge rules (phụ phí giao hàng)
-- Idempotent. No seed. Does not touch customers.boc_xep or route prices.
-- ============================================================

CREATE TABLE IF NOT EXISTS customer_surcharge_rules (
  id              SERIAL PRIMARY KEY,
  ten_khach_hang  VARCHAR(255) NOT NULL,
  customer_id     INTEGER REFERENCES customers(id),
  fee_type        VARCHAR(30) NOT NULL
                    CHECK (fee_type IN ('boc_xep', 'phu_phi_giao_hang', 'chuyen_tai')),
  zone            VARCHAR(20)
                    CHECK (zone IS NULL OR zone IN ('noi_thanh', 'tinh')),
  vehicle_class   VARCHAR(20)
                    CHECK (vehicle_class IS NULL OR vehicle_class IN ('le_2_5', 'gt_8_16', 'gt_16_23', 'pallet')),
  amount          INTEGER NOT NULL CHECK (amount >= 0),
  pricing_unit    VARCHAR(10) NOT NULL
                    CHECK (pricing_unit IN ('tan', 'chuyen')),
  start_date      DATE NOT NULL,
  end_date        DATE,
  created_by      INTEGER REFERENCES users(id),
  updated_by      INTEGER REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT customer_surcharge_rules_dates_chk
    CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_customer_surcharge_rules_name
  ON customer_surcharge_rules (lower(trim(ten_khach_hang)));

CREATE INDEX IF NOT EXISTS idx_customer_surcharge_rules_point_fee
  ON customer_surcharge_rules (customer_id, fee_type);

CREATE INDEX IF NOT EXISTS idx_customer_surcharge_rules_dates
  ON customer_surcharge_rules (start_date, end_date);

DROP TRIGGER IF EXISTS update_customer_surcharge_rules_updated_at ON customer_surcharge_rules;
CREATE TRIGGER update_customer_surcharge_rules_updated_at
  BEFORE UPDATE ON customer_surcharge_rules
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
