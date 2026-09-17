-- ============================================================
-- Migration 036: Drivers and Driver Vehicles Catalog
-- Date: 2026-09-01
-- Module: Quản lý danh mục
-- Description: Danh mục tài xế liên kết tài khoản User và phân công Xe nhà (N-N)
-- ============================================================

CREATE TABLE IF NOT EXISTS drivers (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status          VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deactive')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_user_id_active ON drivers(user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);

DROP TRIGGER IF EXISTS update_drivers_updated_at ON drivers;
CREATE TRIGGER update_drivers_updated_at
  BEFORE UPDATE ON drivers
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE IF NOT EXISTS driver_vehicles (
  id              SERIAL PRIMARY KEY,
  driver_id       INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  vehicle_id      INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(driver_id, vehicle_id)
);

CREATE INDEX IF NOT EXISTS idx_driver_vehicles_driver_id ON driver_vehicles(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_vehicles_vehicle_id ON driver_vehicles(vehicle_id);
