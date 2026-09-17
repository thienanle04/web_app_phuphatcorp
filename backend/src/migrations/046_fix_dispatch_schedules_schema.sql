-- Migration 046: Fix dispatch_schedules schema
-- Purpose: Ensure tan, can columns exist and diem_tra, gio_nhan are removed
-- This migration is idempotent

-- Add tan column if not exists
ALTER TABLE dispatch_schedules 
  ADD COLUMN IF NOT EXISTS tan TEXT;

-- Add can column if not exists  
ALTER TABLE dispatch_schedules 
  ADD COLUMN IF NOT EXISTS can TEXT;

-- Drop diem_tra column if exists
ALTER TABLE dispatch_schedules 
  DROP COLUMN IF EXISTS diem_tra;

-- Drop gio_nhan column if exists
ALTER TABLE dispatch_schedules 
  DROP COLUMN IF EXISTS gio_nhan;

-- Drop ma_chuyen column if exists (no longer used)
ALTER TABLE dispatch_schedules 
  DROP COLUMN IF EXISTS ma_chuyen;

-- Drop trip_code_id column if exists (no longer used)
ALTER TABLE dispatch_schedules 
  DROP COLUMN IF EXISTS trip_code_id;
