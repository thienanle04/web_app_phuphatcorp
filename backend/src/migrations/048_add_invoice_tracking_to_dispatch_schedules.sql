-- Migration 048: Add invoice tracking columns to dispatch_schedules
-- Mở rộng bảng dispatch_schedules để hỗ trợ chức năng Theo dõi hóa đơn

-- Invoice status: created, pending_review, completed, request_supplement
ALTER TABLE dispatch_schedules
  ADD COLUMN IF NOT EXISTS invoice_status VARCHAR(30) NOT NULL DEFAULT 'created';

-- Driver reference (for future row-level filtering)
ALTER TABLE dispatch_schedules
  ADD COLUMN IF NOT EXISTS driver_id INTEGER REFERENCES users(id);

-- Dispatcher who reviewed the ticket
ALTER TABLE dispatch_schedules
  ADD COLUMN IF NOT EXISTS dispatcher_id INTEGER REFERENCES users(id);

-- Documents array: [{ file_name, mime_type, file_data, uploaded_at, note }]
ALTER TABLE dispatch_schedules
  ADD COLUMN IF NOT EXISTS documents JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Supplement note from dispatcher
ALTER TABLE dispatch_schedules
  ADD COLUMN IF NOT EXISTS supplement_note TEXT;

-- Driver note when uploading documents
ALTER TABLE dispatch_schedules
  ADD COLUMN IF NOT EXISTS driver_note TEXT;

-- Timestamp when reviewed by dispatcher
ALTER TABLE dispatch_schedules
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Timestamp when completed
ALTER TABLE dispatch_schedules
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dispatch_schedules_invoice_status
  ON dispatch_schedules(invoice_status);

CREATE INDEX IF NOT EXISTS idx_dispatch_schedules_driver_id
  ON dispatch_schedules(driver_id);
