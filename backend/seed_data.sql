-- Projects
INSERT INTO projects (name, code, location, status, budget)
SELECT 'Commercial Tower A','PRJ-001','Downtown Site','active',50000000
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE code='PRJ-001');

INSERT INTO projects (name, code, location, status, budget)
SELECT 'Residential Block B','PRJ-002','North Site','active',30000000
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE code='PRJ-002');

-- Link manager
UPDATE projects SET manager_id = (SELECT id FROM users WHERE role='project_manager' LIMIT 1)
WHERE manager_id IS NULL;

-- Vendors
INSERT INTO vendors (name, contact_person, email, phone, address, gst_number, performance_score)
SELECT 'Steel Masters Pvt Ltd','Rajesh Kumar','rajesh@steelmasters.com','+91-9876543210','45 Industrial Area Mumbai','27AABCS1429B1Z3',8.5
WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE email='rajesh@steelmasters.com');

INSERT INTO vendors (name, contact_person, email, phone, address, performance_score)
SELECT 'Cement World','Priya Singh','priya@cementworld.com','+91-9876543211','12 Market Road Pune',7.8
WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE email='priya@cementworld.com');

INSERT INTO vendors (name, contact_person, email, phone, address, performance_score)
SELECT 'Electrical Solutions','Amit Patel','amit@elecsoln.com','+91-9876543212','78 Tech Park Bangalore',9.0
WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE email='amit@elecsoln.com');

INSERT INTO vendors (name, contact_person, email, phone, address, performance_score)
SELECT 'Plumbing Depot','Suresh Nair','suresh@plumbdepot.com','+91-9876543213','33 Trade Center Kochi',7.2
WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE email='suresh@plumbdepot.com');

-- Inventory
INSERT INTO inventory (item_code,material_name,category,unit,available_qty,reorder_level,warehouse_location,unit_cost,hsn_code)
SELECT 'STL-001','TMT Bar 12mm Fe500','Steel','MT',45.5,10,'Yard-A1',65000,'7214'
WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE item_code='STL-001');

INSERT INTO inventory (item_code,material_name,category,unit,available_qty,reorder_level,warehouse_location,unit_cost,hsn_code)
SELECT 'STL-002','TMT Bar 16mm Fe500','Steel','MT',30.0,8,'Yard-A1',66000,'7214'
WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE item_code='STL-002');

INSERT INTO inventory (item_code,material_name,category,unit,available_qty,reorder_level,warehouse_location,unit_cost,hsn_code)
SELECT 'STL-003','TMT Bar 20mm Fe500','Steel','MT',5.0,10,'Yard-A2',67000,'7214'
WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE item_code='STL-003');

INSERT INTO inventory (item_code,material_name,category,unit,available_qty,reorder_level,warehouse_location,unit_cost,hsn_code)
SELECT 'CEM-001','OPC 53 Grade Cement','Cement','Bags',850,200,'Godown-B1',380,'2523'
WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE item_code='CEM-001');

INSERT INTO inventory (item_code,material_name,category,unit,available_qty,reorder_level,warehouse_location,unit_cost,hsn_code)
SELECT 'CEM-002','PPC Cement','Cement','Bags',600,150,'Godown-B1',360,'2523'
WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE item_code='CEM-002');

INSERT INTO inventory (item_code,material_name,category,unit,available_qty,reorder_level,warehouse_location,unit_cost,hsn_code)
SELECT 'AGG-001','Coarse Aggregate 20mm','Aggregate','M3',120,30,'Yard-C1',1800,'2517'
WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE item_code='AGG-001');

INSERT INTO inventory (item_code,material_name,category,unit,available_qty,reorder_level,warehouse_location,unit_cost,hsn_code)
SELECT 'AGG-002','Fine Aggregate (Sand)','Aggregate','M3',200,50,'Yard-C2',1500,'2505'
WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE item_code='AGG-002');

INSERT INTO inventory (item_code,material_name,category,unit,available_qty,reorder_level,warehouse_location,unit_cost,hsn_code)
SELECT 'ELE-001','FRLS Wire 2.5 Sqmm','Electrical','Mtr',5000,1000,'Store-D1',45,'8544'
WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE item_code='ELE-001');

INSERT INTO inventory (item_code,material_name,category,unit,available_qty,reorder_level,warehouse_location,unit_cost,hsn_code)
SELECT 'ELE-002','FRLS Wire 6 Sqmm','Electrical','Mtr',2000,500,'Store-D1',95,'8544'
WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE item_code='ELE-002');

INSERT INTO inventory (item_code,material_name,category,unit,available_qty,reorder_level,warehouse_location,unit_cost,hsn_code)
SELECT 'PLM-001','CPVC Pipe 25mm','Plumbing','Mtr',800,200,'Store-E1',120,'3917'
WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE item_code='PLM-001');

INSERT INTO inventory (item_code,material_name,category,unit,available_qty,reorder_level,warehouse_location,unit_cost,hsn_code)
SELECT 'PLM-002','UPVC Pipe 110mm','Plumbing','Mtr',400,100,'Store-E1',280,'3917'
WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE item_code='PLM-002');

INSERT INTO inventory (item_code,material_name,category,unit,available_qty,reorder_level,warehouse_location,unit_cost,hsn_code)
SELECT 'SAF-001','Safety Helmet','Safety','Nos',50,20,'Store-G1',350,'6506'
WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE item_code='SAF-001');

INSERT INTO inventory (item_code,material_name,category,unit,available_qty,reorder_level,warehouse_location,unit_cost,hsn_code)
SELECT 'SAF-002','Safety Harness','Safety','Nos',30,10,'Store-G1',1200,'6217'
WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE item_code='SAF-002');

INSERT INTO inventory (item_code,material_name,category,unit,available_qty,reorder_level,warehouse_location,unit_cost,hsn_code)
SELECT 'PAI-001','Exterior Emulsion Paint','Paints','Ltr',500,100,'Store-H1',220,'3209'
WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE item_code='PAI-001');

INSERT INTO inventory (item_code,material_name,category,unit,available_qty,reorder_level,warehouse_location,unit_cost,hsn_code)
SELECT 'CIV-001','River Sand Washed','Civil','M3',80,20,'Yard-F1',2200,'2505'
WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE item_code='CIV-001');
