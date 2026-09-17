-- 046_create_bang_ke_tho.sql
-- Hub lưu file bảng kê thô 5 nhà (input + khung output theo nhà)

CREATE TABLE IF NOT EXISTS bang_ke_tho_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_filename VARCHAR(255) NOT NULL,
  filename_key VARCHAR(255) NOT NULL UNIQUE,
  input_object_key TEXT NOT NULL,
  input_size_bytes INTEGER NOT NULL,
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bang_ke_tho_batches_uploaded_at
  ON bang_ke_tho_batches (uploaded_at DESC);

CREATE TABLE IF NOT EXISTS bang_ke_tho_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES bang_ke_tho_batches(id) ON DELETE CASCADE,
  house_code VARCHAR(32) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  download_filename VARCHAR(255) NOT NULL,
  object_key TEXT,
  error_message TEXT,
  generated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bang_ke_tho_outputs_house_chk
    CHECK (house_code IN ('nd_mcc', 'clv', 'calofic')),
  CONSTRAINT bang_ke_tho_outputs_status_chk
    CHECK (status IN ('pending', 'ready', 'failed')),
  CONSTRAINT bang_ke_tho_outputs_batch_house_uq UNIQUE (batch_id, house_code)
);
