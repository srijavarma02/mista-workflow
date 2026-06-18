import bcrypt from 'bcryptjs';
import { pool } from '../config/database';
import dotenv from 'dotenv';

dotenv.config();

async function seed(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding database...');

    // Admin user
    const adminHash = await bcrypt.hash('Admin@123', 12);
    await client.query(`
      INSERT INTO users (name, email, password_hash, role, department)
      VALUES
        ('System Admin', 'admin@stores.com', $1, 'admin', 'Administration'),
        ('Site Engineer 1', 'engineer@stores.com', $1, 'site_engineer', 'Civil'),
        ('Project Manager', 'pm@stores.com', $1, 'project_manager', 'Management'),
        ('Stores Executive', 'stores@stores.com', $1, 'stores_executive', 'Stores'),
        ('Procurement Officer', 'procurement@stores.com', $1, 'procurement', 'Procurement'),
        ('QA Inspector', 'qaqc@stores.com', $1, 'qaqc', 'Quality'),
        ('Finance Officer', 'finance@stores.com', $1, 'finance', 'Finance')
      ON CONFLICT (email) DO NOTHING
    `, [adminHash]);
    console.log('✅ Users seeded');

    // Sample project
    const pmRes = await client.query("SELECT id FROM users WHERE role='project_manager' LIMIT 1");
    const pmId = pmRes.rows[0]?.id;

    await client.query(`
      INSERT INTO projects (name, code, location, status, manager_id, budget)
      VALUES
        ('Commercial Tower A', 'PRJ-001', 'Downtown Site', 'active', $1, 50000000),
        ('Residential Block B', 'PRJ-002', 'North Site', 'active', $1, 30000000)
      ON CONFLICT (code) DO NOTHING
    `, [pmId]);
    console.log('✅ Projects seeded');

    // Sample vendors
    await client.query(`
      INSERT INTO vendors (name, contact_person, email, phone, address, gst_number, performance_score)
      VALUES
        ('Steel Masters Pvt Ltd', 'Rajesh Kumar', 'rajesh@steelmasters.com', '+91-9876543210', '45, Industrial Area, Mumbai', '27AABCS1429B1Z3', 8.5),
        ('Cement World', 'Priya Singh', 'priya@cementworld.com', '+91-9876543211', '12, Market Road, Pune', '27AABCC1429B1Z4', 7.8),
        ('Electrical Solutions', 'Amit Patel', 'amit@elecsoln.com', '+91-9876543212', '78, Tech Park, Bangalore', '29AABCE1429B1Z5', 9.0),
        ('Plumbing Depot', 'Suresh Nair', 'suresh@plumbdepot.com', '+91-9876543213', '33, Trade Center, Kochi', '32AABCP1429B1Z6', 7.2)
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ Vendors seeded');

    // Sample inventory
    await client.query(`
      INSERT INTO inventory (item_code, material_name, category, unit, available_qty, reorder_level, warehouse_location, unit_cost, hsn_code)
      VALUES
        ('STL-001', 'TMT Bar 12mm Fe500', 'Steel', 'MT', 45.5, 10, 'Yard-A1', 65000, '7214'),
        ('STL-002', 'TMT Bar 16mm Fe500', 'Steel', 'MT', 30.0, 8, 'Yard-A1', 66000, '7214'),
        ('STL-003', 'TMT Bar 20mm Fe500', 'Steel', 'MT', 5.0, 10, 'Yard-A2', 67000, '7214'),
        ('CEM-001', 'OPC 53 Grade Cement', 'Cement', 'Bags', 850, 200, 'Godown-B1', 380, '2523'),
        ('CEM-002', 'PPC Cement', 'Cement', 'Bags', 600, 150, 'Godown-B1', 360, '2523'),
        ('AGG-001', 'Coarse Aggregate 20mm', 'Aggregate', 'M3', 120, 30, 'Yard-C1', 1800, '2517'),
        ('AGG-002', 'Fine Aggregate (Sand)', 'Aggregate', 'M3', 200, 50, 'Yard-C2', 1500, '2505'),
        ('ELE-001', 'FRLS Wire 2.5 Sqmm', 'Electrical', 'Mtr', 5000, 1000, 'Store-D1', 45, '8544'),
        ('ELE-002', 'FRLS Wire 6 Sqmm', 'Electrical', 'Mtr', 2000, 500, 'Store-D1', 95, '8544'),
        ('PLM-001', 'CPVC Pipe 25mm', 'Plumbing', 'Mtr', 800, 200, 'Store-E1', 120, '3917'),
        ('PLM-002', 'UPVC Pipe 110mm', 'Plumbing', 'Mtr', 400, 100, 'Store-E1', 280, '3917'),
        ('CIV-001', 'River Sand (Washed)', 'Civil', 'M3', 80, 20, 'Yard-F1', 2200, '2505'),
        ('SAF-001', 'Safety Helmet', 'Safety', 'Nos', 50, 20, 'Store-G1', 350, '6506'),
        ('SAF-002', 'Safety Harness', 'Safety', 'Nos', 30, 10, 'Store-G1', 1200, '6217'),
        ('PAI-001', 'Exterior Emulsion Paint', 'Paints', 'Ltr', 500, 100, 'Store-H1', 220, '3209')
      ON CONFLICT (item_code) DO NOTHING
    `);
    console.log('✅ Inventory seeded');

    // Create material master records from inventory items
    await client.query(`
      INSERT INTO material_master (material_code, material_name, category, unit_of_measurement, reorder_level, description, status)
      SELECT item_code, material_name, category, unit, reorder_level, 'Created from inventory seed', 'active'
      FROM inventory
      WHERE NOT EXISTS (
        SELECT 1 FROM material_master mm WHERE mm.material_code = inventory.item_code
      )
    `);
    console.log('✅ Material master seeded from inventory');

    // Link inventory rows to material master records by item_code/material_code
    await client.query(`
      UPDATE inventory
      SET material_master_id = mm.id
      FROM material_master mm
      WHERE inventory.item_code = mm.material_code
        AND inventory.material_master_id IS NULL
    `);
    console.log('✅ Inventory linked to material master');

    console.log('\n✅ Database seeded successfully!');
    console.log('\n📧 Login credentials (all users):');
    console.log('   Password: Admin@123');
    console.log('   admin@stores.com        → Admin');
    console.log('   engineer@stores.com     → Site Engineer');
    console.log('   pm@stores.com           → Project Manager');
    console.log('   stores@stores.com       → Stores Executive');
    console.log('   procurement@stores.com  → Procurement');
    console.log('   qaqc@stores.com         → QA/QC');
    console.log('   finance@stores.com      → Finance');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => { console.error(err); process.exit(1); });
