-- Seed default roles with permissions
INSERT INTO roles (name, permissions) VALUES
('admin', '["*"]'),
('site_engineer', '["mrf:create","mrf:read","issue:read","return:create","return:read"]'),
('project_manager', '["mrf:approve","mrf:reject","mrf:read","inventory:read","report:read","issue:approve"]'),
('stores_executive', '["inventory:*","mrf:read","issue:*","grn:*","return:*","ledger:read"]'),
('procurement', '["po:*","vendor:*","pr:*","grn:read","invoice:read"]'),
('qaqc', '["inspection:*","grn:read","document:*"]'),
('finance', '["invoice:*","report:read","po:read"]')
ON CONFLICT (name) DO NOTHING;
