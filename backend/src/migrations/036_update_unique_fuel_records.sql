-- ============================================================
-- Migration 036: Drop unique vehicle_date and update unique key
-- Date: 2026-06-21
-- Purpose: Allow multiple fuel records per vehicle per day with different cost/odometer/liters
-- ============================================================

DO $$
BEGIN
  -- 1. Drop old constraint on (vehicle_id, record_date)
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_fuel_records_vehicle_date'
  ) THEN
    ALTER TABLE fuel_records
    DROP CONSTRAINT uq_fuel_records_vehicle_date;
  END IF;

  -- 2. Drop intermediate constraint if exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_fuel_records_vehicle_date_odo_liters'
  ) THEN
    ALTER TABLE fuel_records
    DROP CONSTRAINT uq_fuel_records_vehicle_date_odo_liters;
  END IF;

  -- 3. Add unique constraint on (vehicle_id, record_date, odometer_old, liters, total_cost)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_fuel_records_unique_entry'
  ) THEN
    ALTER TABLE fuel_records
    ADD CONSTRAINT uq_fuel_records_unique_entry
    UNIQUE (vehicle_id, record_date, odometer_old, liters, total_cost);
  END IF;
END $$;
