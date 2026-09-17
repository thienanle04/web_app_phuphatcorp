-- Migration 045: Drop gio_nhan column from dispatch_schedules
-- Purpose: Remove "Giờ nhận" column

ALTER TABLE dispatch_schedules
  DROP COLUMN IF EXISTS gio_nhan;
