import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { createError } from '../middleware/errorHandler';
import { getLowStockItems, getStockLedger } from '../services/inventoryService';

export async function getInventory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { search, category, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    const params: unknown[] = [];
    const conditions: string[] = ['is_active = true'];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(material_name ILIKE $${params.length} OR item_code ILIKE $${params.length})`);
    }
    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const countRes = await query(`SELECT COUNT(*) FROM inventory ${where}`, params);
    params.push(parseInt(limit as string), offset);

    const dataRes = await query(
      `SELECT * FROM inventory ${where} ORDER BY material_name LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      success: true,
      data: dataRes.rows,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: parseInt((countRes.rows[0] as { count: string }).count),
        totalPages: Math.ceil(parseInt((countRes.rows[0] as { count: string }).count) / parseInt(limit as string)),
      },
    });
  } catch (err) { next(err); }
}

export async function getInventoryItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await query('SELECT * FROM inventory WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) throw createError('Item not found', 404);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
}

export async function createInventoryItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      item_code, material_name, category, unit, available_qty = 0,
      reorder_level = 0, warehouse_location, unit_cost = 0, hsn_code,
    } = req.body;

    if (!item_code || !material_name || !category || !unit)
      throw createError('item_code, material_name, category, and unit are required');

    const result = await query(
      `INSERT INTO inventory (item_code, material_name, category, unit, available_qty, reorder_level, warehouse_location, unit_cost, hsn_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [item_code, material_name, category, unit, available_qty, reorder_level, warehouse_location, unit_cost, hsn_code]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
}

export async function updateInventoryItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const allowed = ['material_name','category','unit','reorder_level','warehouse_location','unit_cost','hsn_code','is_active'];
    const updates: string[] = [];
    const values: unknown[] = [];

    Object.entries(req.body).forEach(([key, val]) => {
      if (allowed.includes(key)) {
        values.push(val);
        updates.push(`${key} = $${values.length}`);
      }
    });

    if (!updates.length) throw createError('No valid fields to update');
    values.push(req.params.id);
    const result = await query(
      `UPDATE inventory SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!result.rows[0]) throw createError('Item not found', 404);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
}

export async function getLowStock(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const items = await getLowStockItems();
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
}

export async function getItemLedger(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const limit = parseInt(req.query.limit as string || '100');
    const entries = await getStockLedger(req.params.id, limit);
    res.json({ success: true, data: entries });
  } catch (err) { next(err); }
}

export async function getCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await query('SELECT DISTINCT category FROM inventory WHERE is_active=true ORDER BY category');
    res.json({ success: true, data: result.rows.map((r: { category: string }) => r.category) });
  } catch (err) { next(err); }
}
