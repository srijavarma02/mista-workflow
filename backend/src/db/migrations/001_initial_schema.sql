-- ============================================================
-- STORES & INVENTORY MANAGEMENT SYSTEM – DATABASE SCHEMA
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ROLES & USERS
-- ============================================================

CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(50) UNIQUE NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(150) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(50) NOT NULL REFERENCES roles(name) ON UPDATE CASCADE,
  department    VARCHAR(100),
  phone         VARCHAR(30),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email   ON users(email);
CREATE INDEX idx_users_role    ON users(role);

-- ============================================================
-- PROJECTS
-- ============================================================

CREATE TABLE projects (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(255) NOT NULL,
  code        VARCHAR(50)  UNIQUE NOT NULL,
  location    VARCHAR(255),
  status      VARCHAR(30)  NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','on_hold','cancelled')),
  manager_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  start_date  DATE,
  end_date    DATE,
  budget      NUMERIC(18,2),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_status     ON projects(status);
CREATE INDEX idx_projects_manager_id ON projects(manager_id);

-- ============================================================
-- VENDORS
-- ============================================================

CREATE TABLE vendors (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(255) NOT NULL,
  contact_person    VARCHAR(150),
  email             VARCHAR(255),
  phone             VARCHAR(30),
  address           TEXT,
  gst_number        VARCHAR(50),
  performance_score NUMERIC(3,1) NOT NULL DEFAULT 5.0 CHECK (performance_score BETWEEN 0 AND 10),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INVENTORY
-- ============================================================

CREATE TABLE inventory (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_code           VARCHAR(50) UNIQUE NOT NULL,
  material_name       VARCHAR(255) NOT NULL,
  category            VARCHAR(100) NOT NULL,
  unit                VARCHAR(30)  NOT NULL,
  available_qty       NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (available_qty >= 0),
  reserved_qty        NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
  reorder_level       NUMERIC(14,3) NOT NULL DEFAULT 0,
  warehouse_location  VARCHAR(150),
  unit_cost           NUMERIC(14,2) NOT NULL DEFAULT 0,
  hsn_code            VARCHAR(30),
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inventory_category  ON inventory(category);
CREATE INDEX idx_inventory_item_code ON inventory(item_code);

-- ============================================================
-- MATERIAL REQUESTS (MRF)
-- ============================================================

CREATE TABLE material_requests (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_number VARCHAR(30) UNIQUE NOT NULL,
  project_id     UUID NOT NULL REFERENCES projects(id),
  requester_id   UUID NOT NULL REFERENCES users(id),
  material_name  VARCHAR(255) NOT NULL,
  inventory_id   UUID REFERENCES inventory(id),
  quantity       NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  unit           VARCHAR(30) NOT NULL,
  required_date  DATE NOT NULL,
  priority       VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  remarks        TEXT,
  status         VARCHAR(30) NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','submitted','approved','rejected','fulfilled','partially_fulfilled')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mrf_project    ON material_requests(project_id);
CREATE INDEX idx_mrf_requester  ON material_requests(requester_id);
CREATE INDEX idx_mrf_status     ON material_requests(status);

-- ============================================================
-- APPROVALS
-- ============================================================

CREATE TABLE approvals (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type  VARCHAR(50) NOT NULL,  -- 'material_request', 'material_issue', 'grn', etc.
  entity_id    UUID NOT NULL,
  approver_id  UUID NOT NULL REFERENCES users(id),
  status       VARCHAR(20) NOT NULL CHECK (status IN ('pending','approved','rejected')),
  remarks      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_approvals_entity    ON approvals(entity_type, entity_id);
CREATE INDEX idx_approvals_approver  ON approvals(approver_id);

-- ============================================================
-- PURCHASE REQUESTS
-- ============================================================

CREATE TABLE purchase_requests (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pr_number           VARCHAR(30) UNIQUE NOT NULL,
  material_request_id UUID REFERENCES material_requests(id),
  inventory_id        UUID NOT NULL REFERENCES inventory(id),
  quantity            NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  unit                VARCHAR(30) NOT NULL,
  status              VARCHAR(30) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','po_raised','completed','cancelled')),
  created_by          UUID NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PURCHASE ORDERS
-- ============================================================

CREATE TABLE purchase_orders (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_number      VARCHAR(30) UNIQUE NOT NULL,
  vendor_id      UUID NOT NULL REFERENCES vendors(id),
  status         VARCHAR(30) NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','sent','confirmed','partially_delivered','delivered','cancelled')),
  total_amount   NUMERIC(18,2) NOT NULL DEFAULT 0,
  delivery_date  DATE,
  notes          TEXT,
  created_by     UUID NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_po_vendor ON purchase_orders(vendor_id);
CREATE INDEX idx_po_status ON purchase_orders(status);

CREATE TABLE po_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id         UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  inventory_id  UUID NOT NULL REFERENCES inventory(id),
  pr_id         UUID REFERENCES purchase_requests(id),
  quantity      NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  unit_price    NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
  total_price   NUMERIC(18,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  quantity_received NUMERIC(14,3) NOT NULL DEFAULT 0
);

CREATE INDEX idx_po_items_po_id ON po_items(po_id);

-- ============================================================
-- GOODS RECEIPT NOTES (GRN)
-- ============================================================

CREATE TABLE grns (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grn_number    VARCHAR(30) UNIQUE NOT NULL,
  po_id         UUID NOT NULL REFERENCES purchase_orders(id),
  received_by   UUID NOT NULL REFERENCES users(id),
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vehicle_no    VARCHAR(50),
  driver_name   VARCHAR(100),
  status        VARCHAR(30) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','inspected','accepted','rejected','partial')),
  remarks       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_grn_po_id ON grns(po_id);

CREATE TABLE grn_items (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grn_id              UUID NOT NULL REFERENCES grns(id) ON DELETE CASCADE,
  po_item_id          UUID NOT NULL REFERENCES po_items(id),
  inventory_id        UUID NOT NULL REFERENCES inventory(id),
  quantity_received   NUMERIC(14,3) NOT NULL CHECK (quantity_received >= 0),
  quantity_accepted   NUMERIC(14,3) NOT NULL DEFAULT 0,
  quantity_rejected   NUMERIC(14,3) NOT NULL DEFAULT 0,
  rejection_reason    TEXT
);

-- ============================================================
-- INSPECTIONS
-- ============================================================

CREATE TABLE inspections (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grn_id                UUID NOT NULL REFERENCES grns(id),
  inspector_id          UUID NOT NULL REFERENCES users(id),
  test_certificates_ok  BOOLEAN,
  po_compliance_ok      BOOLEAN,
  physical_condition    VARCHAR(20) CHECK (physical_condition IN ('good','damaged','partial')),
  result                VARCHAR(10) NOT NULL CHECK (result IN ('pass','fail')),
  remarks               TEXT,
  inspected_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inspections_grn ON inspections(grn_id);

-- ============================================================
-- MATERIAL ISSUES (MIN)
-- ============================================================

CREATE TABLE material_issues (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  issue_number        VARCHAR(30) UNIQUE NOT NULL,
  material_request_id UUID REFERENCES material_requests(id),
  project_id          UUID REFERENCES projects(id),
  issued_by           UUID NOT NULL REFERENCES users(id),
  received_by         UUID NOT NULL REFERENCES users(id),
  issue_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  status              VARCHAR(30) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','issued','cancelled')),
  approved_by         UUID REFERENCES users(id),
  approved_at         TIMESTAMPTZ,
  remarks             TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_min_project   ON material_issues(project_id);
CREATE INDEX idx_min_status    ON material_issues(status);

CREATE TABLE issue_items (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  issue_id           UUID NOT NULL REFERENCES material_issues(id) ON DELETE CASCADE,
  inventory_id       UUID NOT NULL REFERENCES inventory(id),
  quantity_requested NUMERIC(14,3) NOT NULL CHECK (quantity_requested > 0),
  quantity_issued    NUMERIC(14,3) NOT NULL DEFAULT 0
);

-- ============================================================
-- MATERIAL RETURNS
-- ============================================================

CREATE TABLE material_returns (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_number VARCHAR(30) UNIQUE NOT NULL,
  issue_id     UUID REFERENCES material_issues(id),
  project_id   UUID REFERENCES projects(id),
  returned_by  UUID NOT NULL REFERENCES users(id),
  received_by  UUID REFERENCES users(id),
  return_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  reason       TEXT,
  condition    VARCHAR(30) CHECK (condition IN ('good','damaged','partial')),
  status       VARCHAR(30) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','received','rejected')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE return_items (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_id        UUID NOT NULL REFERENCES material_returns(id) ON DELETE CASCADE,
  inventory_id     UUID NOT NULL REFERENCES inventory(id),
  quantity_returned NUMERIC(14,3) NOT NULL CHECK (quantity_returned > 0)
);

-- ============================================================
-- INVOICES
-- ============================================================

CREATE TABLE invoices (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number   VARCHAR(100) NOT NULL,
  po_id            UUID NOT NULL REFERENCES purchase_orders(id),
  grn_id           UUID REFERENCES grns(id),
  vendor_id        UUID NOT NULL REFERENCES vendors(id),
  amount           NUMERIC(18,2) NOT NULL CHECK (amount >= 0),
  tax_amount       NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_amount     NUMERIC(18,2) NOT NULL,
  status           VARCHAR(30) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','verified','approved','paid','rejected')),
  file_url         VARCHAR(500),
  received_date    DATE,
  due_date         DATE,
  paid_date        DATE,
  verified_by      UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DOCUMENTS
-- ============================================================

CREATE TABLE documents (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type  VARCHAR(50) NOT NULL,
  entity_id    UUID NOT NULL,
  file_name    VARCHAR(255) NOT NULL,
  file_url     VARCHAR(500) NOT NULL,
  file_type    VARCHAR(50),
  file_size    BIGINT,
  uploaded_by  UUID NOT NULL REFERENCES users(id),
  version      INTEGER NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_entity ON documents(entity_type, entity_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        VARCHAR(255) NOT NULL,
  message      TEXT NOT NULL,
  type         VARCHAR(30) NOT NULL CHECK (type IN ('info','warning','error','success')),
  channel      VARCHAR(20) NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app','email','whatsapp','all')),
  is_read      BOOLEAN NOT NULL DEFAULT FALSE,
  entity_type  VARCHAR(50),
  entity_id    UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_user    ON notifications(user_id, is_read);
CREATE INDEX idx_notif_created ON notifications(created_at DESC);

-- ============================================================
-- STOCK LEDGER
-- ============================================================

CREATE TABLE stock_ledger (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_id     UUID NOT NULL REFERENCES inventory(id),
  transaction_type VARCHAR(30) NOT NULL
                     CHECK (transaction_type IN ('inward','issue','return','adjustment','reserved','unreserved')),
  quantity         NUMERIC(14,3) NOT NULL,
  balance_after    NUMERIC(14,3) NOT NULL,
  reference_type   VARCHAR(50),  -- 'grn','material_issue','material_return', etc.
  reference_id     UUID,
  notes            TEXT,
  created_by       UUID NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ledger_inventory ON stock_ledger(inventory_id, created_at DESC);

-- ============================================================
-- AUDIT LOGS
-- ============================================================

CREATE TABLE audit_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  action       VARCHAR(50) NOT NULL,  -- 'CREATE','UPDATE','DELETE','LOGIN','LOGOUT'
  entity_type  VARCHAR(50),
  entity_id    UUID,
  old_value    JSONB,
  new_value    JSONB,
  ip_address   INET,
  user_agent   VARCHAR(500),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user      ON audit_logs(user_id);
CREATE INDEX idx_audit_entity    ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created   ON audit_logs(created_at DESC);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'users','projects','vendors','inventory','material_requests',
    'purchase_requests','purchase_orders','grns','material_issues',
    'material_returns','invoices'
  ]
  LOOP
    EXECUTE format('
      CREATE TRIGGER trg_updated_at_%I
      BEFORE UPDATE ON %I
      FOR EACH ROW EXECUTE FUNCTION update_updated_at()', tbl, tbl);
  END LOOP;
END;
$$;
