import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../../config/database';
import { AuthenticatedRequest, InventoryItem, StockLedgerEntry } from '../../types';
import { AppError } from '../../middleware/errorHandler';

export async function listInventory(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
    const offset = (page - 1) * limit;
    const search = String(req.query.search || '');
    const category = String(req.query.category || '');

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (search) {
      conditions.push(`(material_name ILIKE $${idx} OR item_code ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (category) {
      conditions.push(`category = $${idx}`);
      params.push(category);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM inventory ${where}`,
      params
    );

    params.push(limit, offset);
    const { rows } = await query<InventoryItem>(
      `SELECT * FROM inventory ${where}
       ORDER BY material_name ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    const total = parseInt(countResult.rows[0].count, 10);
    res.status(200).json({
      success: true,
      data: rows,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

export async function getLowStockItems(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { rows } = await query<InventoryItem>(
      `SELECT * FROM inventory
       WHERE available_qty <= reorder_level
       ORDER BY (reorder_level - available_qty) DESC`
    );
    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

export async function getInventoryById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { rows } = await query<InventoryItem>(
      'SELECT * FROM inventory WHERE id = $1',
      [req.params.id]
    );

    if (rows.length === 0) throw new AppError('Inventory item not found.', 404, 'NOT_FOUND');
    res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function getLedger(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(100, parseInt(String(req.query.limit || '20'), 10));
    const offset = (page - 1) * limit;

    const { rows } = await query<StockLedgerEntry & { created_by_name: string }>(
      `SELECT sl.*, u.name AS created_by_name
       FROM stock_ledger sl
       LEFT JOIN users u ON u.id = sl.created_by
       WHERE sl.inventory_id = $1
       ORDER BY sl.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.params.id, limit, offset]
    );

    const countResult = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM stock_ledger WHERE inventory_id = $1',
      [req.params.id]
    );

    const total = parseInt(countResult.rows[0].count, 10);
    res.status(200).json({
      success: true,
      data: rows,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

export async function createInventoryItem(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const {
      item_code, material_name, category, unit,
      available_qty, reorder_level, unit_cost, warehouse_location,
    } = req.body as InventoryItem;

    const id = uuidv4();

    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO inventory
           (id, item_code, material_name, category, unit, available_qty, reserved_qty, reorder_level, warehouse_location, unit_cost)
         VALUES ($1,$2,$3,$4,$5,$6,0,$7,$8,$9)`,
        [id, item_code, material_name, category, unit, available_qty, reorder_level, warehouse_location ?? null, unit_cost]
      );

      // Opening entry in stock ledger
      if (available_qty > 0) {
        await client.query(
          `INSERT INTO stock_ledger
             (id, inventory_id, transaction_type, quantity, balance_after, reference_type, created_by)
           VALUES ($1,$2,'opening',$3,$4,'manual',$5)`,
          [uuidv4(), id, available_qty, available_qty, req.user?.sub ?? null]
        );
      }
    });

    const { rows } = await query<InventoryItem>('SELECT * FROM inventory WHERE id = $1', [id]);
    res.status(201).json({ success: true, data: rows[0], message: 'Inventory item created.' });
  } catch (err) {
    next(err);
  }
}

export async function updateInventoryItem(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { id } = req.params;
    const {
      material_name, category, unit, reorder_level, unit_cost, warehouse_location,
    } = req.body as Partial<InventoryItem>;

    const existing = await query<InventoryItem>('SELECT * FROM inventory WHERE id = $1', [id]);
    if (existing.rows.length === 0) throw new AppError('Inventory item not found.', 404, 'NOT_FOUND');

    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (material_name)      { updates.push(`material_name = $${idx++}`);      params.push(material_name); }
    if (category)           { updates.push(`category = $${idx++}`);           params.push(category); }
    if (unit)               { updates.push(`unit = $${idx++}`);               params.push(unit); }
    if (reorder_level !== undefined) { updates.push(`reorder_level = $${idx++}`); params.push(reorder_level); }
    if (unit_cost !== undefined)     { updates.push(`unit_cost = $${idx++}`);     params.push(unit_cost); }
    if (warehouse_location !== undefined) { updates.push(`warehouse_location = $${idx++}`); params.push(warehouse_location); }

    if (updates.length === 0) {
      res.status(400).json({ success: false, message: 'No fields to update.' });
      return;
    }

    updates.push('updated_at = NOW()');
    params.push(id);

    await query(`UPDATE inventory SET ${updates.join(', ')} WHERE id = $${idx}`, params);

    const { rows } = await query<InventoryItem>('SELECT * FROM inventory WHERE id = $1', [id]);
    res.status(200).json({ success: true, data: rows[0], message: 'Inventory item updated.' });
  } catch (err) {
    next(err);
  }
}

export async function adjustStock(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { id } = req.params;
    const { quantity, reason } = req.body as { quantity: number; reason: string };

    await withTransaction(async (client) => {
      const result = await client.query<InventoryItem>(
        'SELECT * FROM inventory WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (result.rows.length === 0) throw new AppError('Inventory item not found.', 404, 'NOT_FOUND');

      const item = result.rows[0];
      const newQty = item.available_qty + quantity;

      if (newQty < 0) {
        throw new AppError(
          `Adjustment would result in negative stock. Current: ${item.available_qty}, Adjustment: ${quantity}`,
          400,
          'INSUFFICIENT_STOCK'
        );
      }

      await client.query(
        'UPDATE inventory SET available_qty = $1, updated_at = NOW() WHERE id = $2',
        [newQty, id]
      );

      await client.query(
        `INSERT INTO stock_ledger
           (id, inventory_id, transaction_type, quantity, balance_after, reference_type, created_by)
         VALUES ($1,$2,'adjustment',$3,$4,$5,$6)`,
        [uuidv4(), id, quantity, newQty, reason, req.user?.sub ?? null]
      );
    });

    const { rows } = await query<InventoryItem>('SELECT * FROM inventory WHERE id = $1', [id]);
    res.status(200).json({ success: true, data: rows[0], message: 'Stock adjusted successfully.' });
  } catch (err) {
    next(err);
  }
}
