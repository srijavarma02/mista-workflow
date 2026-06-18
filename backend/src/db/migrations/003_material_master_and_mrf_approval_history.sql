-- ============================================================
-- Material Master and MRF Approval History
-- ============================================================

CREATE TABLE material_master (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_code VARCHAR(50) UNIQUE NOT NULL,
  material_name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  unit_of_measurement VARCHAR(50) NOT NULL,
  reorder_level NUMERIC(14,3) NOT NULL DEFAULT 0,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_material_master_code ON material_master(material_code);
CREATE INDEX idx_material_master_name ON material_master(material_name);

ALTER TABLE inventory
  ADD COLUMN material_master_id UUID REFERENCES material_master(id);

CREATE INDEX idx_inventory_material_master_id ON inventory(material_master_id);

ALTER TABLE material_requests
  ADD COLUMN material_master_id UUID REFERENCES material_master(id),
  ADD COLUMN approved_quantity NUMERIC(14,3);

CREATE INDEX idx_mrf_material_master_id ON material_requests(material_master_id);

ALTER TABLE purchase_requests
  ALTER COLUMN inventory_id DROP NOT NULL;

CREATE TABLE mrf_approval_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_request_id UUID NOT NULL REFERENCES material_requests(id),
  approver_id UUID NOT NULL REFERENCES users(id),
  requested_quantity NUMERIC(14,3) NOT NULL,
  approved_quantity NUMERIC(14,3) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('approved','rejected')),
  remarks TEXT,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mrf_approval_mrf_id ON mrf_approval_history(material_request_id);
CREATE INDEX idx_mrf_approval_approver ON mrf_approval_history(approver_id);
