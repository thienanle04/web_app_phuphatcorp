-- Migration 047: Add bien_so, tai_xe, vehicle_id to dispatch_schedules
-- These columns were in original migration 006 but missing from actual DB

ALTER TABLE dispatch_schedules
  ADD COLUMN IF NOT EXISTS bien_so VARCHAR(50);

ALTER TABLE dispatch_schedules
  ADD COLUMN IF NOT EXISTS tai_xe TEXT;

ALTER TABLE dispatch_schedules
  ADD COLUMN IF NOT EXISTS vehicle_id INTEGER;
