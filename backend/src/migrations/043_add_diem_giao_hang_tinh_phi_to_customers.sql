-- Migration 043: Add diem_giao_hang_tinh_phi (optional text) to customers
-- Date: 2026-08-17
-- Idempotent

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS diem_giao_hang_tinh_phi VARCHAR(255);
