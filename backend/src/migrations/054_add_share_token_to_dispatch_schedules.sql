-- Migration 054: Add share_token to dispatch_schedules for public ticket viewing
-- Cho phép chia sẻ đường link công khai để xem chứng từ ticket không cần đăng nhập

ALTER TABLE dispatch_schedules
  ADD COLUMN IF NOT EXISTS share_token VARCHAR(64) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_dispatch_schedules_share_token
  ON dispatch_schedules(share_token);
