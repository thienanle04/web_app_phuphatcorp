-- Drop delivery_schedules table (feature removed 2026-08-19)
-- Feature "Lịch đi hàng" replaced by "Hóa đơn tài xế" (driver_invoices)
-- No other tables reference this table (no FK dependencies)

DROP TABLE IF EXISTS delivery_schedules;
