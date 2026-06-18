import { PoolClient } from 'pg';
import { query, getClient } from '../config/database';
import { notifyRole } from './notificationService';

export type TransactionType = 'inward' | 'issue' | 'return' | 'adjustment' | 'reserved' | 'unreserved';

/**
 * Adjust inventory quantity and record in stock_ledger.
 * Pass positive qty for additions (inward/return), negative for deductions (issue).
 */
export async function adjustStock(
  inventoryId: string,
  qty: number,
  transactionType: TransactionType,
  referenceType: string,
  referenceId: string,
  createdBy: string,
  notes?: string,
  client?: PoolClient
): Promise<number> {
  const run = client
    ? (text: string, params: unknown[]) => client.query(text, params)
    : (text: string, params: unknown[]) => query(text, params);

  // Lock the inventory row
  const result = await run(
    'SELECT available_qty, reserved_qty, reorder_level, material_name FROM inventory WHERE id = $1 FOR UPDATE',
    [inventoryId]
  );

  if (!result.rows.length) throw new Error('Inventory item not found');

  const item = result.rows[0] as {
    available_qty: number;
    reserved_qty: number;
    reorder_level: number;
    material_name: string;
  };

  let newAvail = parseFloat(item.available_qty as unknown as string) + qty;

  if (newAvail < 0) {
    throw new Error(`Insufficient stock for ${item.material_name}. Available: ${item.available_qty}`);
  }

  // Update inventory
  await run(
    'UPDATE inventory SET available_qty = $1, updated_at = NOW() WHERE id = $2',
    [newAvail, inventoryId]
  );

  // Insert ledger entry
  await run(
    `INSERT INTO stock_ledger (inventory_id, transaction_type, quantity, balance_after, reference_type, reference_id, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [inventoryId, transactionType, qty, newAvail, referenceType, referenceId, notes || null, createdBy]
  );

  // Check low stock
  if (newAvail <= parseFloat(item.reorder_level as unknown as string)) {
    await notifyRole('procurement', {
      title: 'Low Stock Alert',
      message: `${item.material_name} is below reorder level. Current: ${newAvail}.`,
      type: 'warning',
      entityType: 'inventory',
      entityId: inventoryId,
    });
    await notifyRole('stores_executive', {
      title: 'Low Stock Alert',
      message: `${item.material_name} is below reorder level. Current: ${newAvail}.`,
      type: 'warning',
      entityType: 'inventory',
      entityId: inventoryId,
    });
  }

  return newAvail;
}

export async function reserveStock(
  inventoryId: string,
  qty: number,
  createdBy: string
): Promise<void> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const res = await client.query<{ available_qty: number; reserved_qty: number }>(
      'SELECT available_qty, reserved_qty FROM inventory WHERE id = $1 FOR UPDATE',
      [inventoryId]
    );
    if (!res.rows.length) throw new Error('Inventory item not found');

    const item = res.rows[0];
    if (parseFloat(item.available_qty as unknown as string) < qty) {
      throw new Error('Insufficient stock to reserve');
    }

    await client.query(
      'UPDATE inventory SET available_qty = available_qty - $1, reserved_qty = reserved_qty + $1 WHERE id = $2',
      [qty, inventoryId]
    );

    await client.query(
      `INSERT INTO stock_ledger (inventory_id, transaction_type, quantity, balance_after, reference_type, created_by)
       VALUES ($1, 'reserved', $2, available_qty - $2, 'reservation', $3)`,
      [inventoryId, qty, createdBy]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getLowStockItems(): Promise<unknown[]> {
  const result = await query(
    `SELECT id, item_code, material_name, category, unit,
            available_qty, reorder_level, warehouse_location
     FROM inventory
     WHERE available_qty <= reorder_level AND is_active = true
     ORDER BY (available_qty / NULLIF(reorder_level, 0)) ASC`
  );
  return result.rows;
}

export async function getStockLedger(inventoryId: string, limit = 50): Promise<unknown[]> {
  const result = await query(
    `SELECT sl.*, u.name AS created_by_name
     FROM stock_ledger sl
     LEFT JOIN users u ON u.id = sl.created_by
     WHERE sl.inventory_id = $1
     ORDER BY sl.created_at DESC
     LIMIT $2`,
    [inventoryId, limit]
  );
  return result.rows;
}
