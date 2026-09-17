-- Migration 053: Create composite index for invoice tracking performance
-- Tối ưu hóa truy vấn danh sách Theo dõi hóa đơn

CREATE INDEX IF NOT EXISTS idx_dispatch_schedules_invoice_list
  ON dispatch_schedules(invoice_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dispatch_schedules_driver_invoice_list
  ON dispatch_schedules(driver_id, invoice_status, created_at DESC);
