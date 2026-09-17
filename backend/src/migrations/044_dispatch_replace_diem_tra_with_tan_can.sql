-- Migration 044: Replace diem_tra with tan and can columns in dispatch_schedules
-- Purpose: Remove "Điểm trả" column, add "Tấn" and "CAN" columns (both TEXT)

ALTER TABLE dispatch_schedules
  DROP COLUMN IF EXISTS diem_tra;

ALTER TABLE dispatch_schedules
  ADD COLUMN IF NOT EXISTS tan TEXT,
  ADD COLUMN IF NOT EXISTS can TEXT;
