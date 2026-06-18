import { Request, Response, NextFunction } from 'express';
import { query, getClient } from '../config/database';
import { createError } from '../middleware/errorHandler';
import { nextNumber } from '../services/sequenceService';
import { notifyRole } from '../services/notificationService';

export async function createPO(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { vendor_id, delivery_date, notes, items } = req.body;
    if (!vendor_id || !items?.length) throw createError('vendor_id and items are required');

    const client = await getClient();
    try {
      await client.query('BEGIN');
      const po_number = await nextNumber('purchase_order');

      const totalAmount = items.reduce(
        (sum: number, item: { quantity: number; unit_price: number }) =>
          sum + item.quantity * item.unit_price,
        0
      );

      const poRes = await client.query(
        `INSERT INTO purchase_orders (po_number, vendor_id, total_amount, delivery_date, notes, status, created_by)
         VALUES ($1,$2,$3,$4,$5,'draft',$6) RETURNING *`,
        [po_number, vendor_id, totalAmount, delivery_date || null, notes || null, req.user!.userId]
      );

      for (const item of items as Array<{ inventory_id: string; pr_id?: string; quantity: number; unit_price: number }>) {
        await client.query(
          `INSERT INTO po_items (po_id, inventory_id, pr_id, quantity, unit_price)
           VALUES ($1,$2,$3,$4,$5)`,
          [poRes.rows[0].id, item.inventory_id, item.pr_id || null, item.quantity, item.unit_price]
        );
      }

      await client.query('COMMIT');

      // Notify stores about incoming material
      await notifyRole('stores_executive', {
        title: 'Purchase Order Created',
        message: `PO ${po_number} created with ${items.length} item(s). Expected by ${delivery_date || 'TBD'}.`,
        type: 'info',
        entityType: 'purchase_order',
        entityId: poRes.rows[0].id,
      });

      res.status(201).json({ success: true, data: poRes.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
}

export async function getPOs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, vendor_id, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    const params: unknown[] = [];
    const conds: string[] = [];

    if (status) { params.push(status); conds.push(`po.status = $${params.length}`); }
    if (vendor_id) { params.push(vendor_id); conds.push(`po.vendor_id = $${params.length}`); }

    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const countRes = await query(`SELECT COUNT(*) FROM purchase_orders po ${where}`, params);
    params.push(parseInt(limit as string), offset);

    const dataRes = await query(
      `SELECT po.*, v.name AS vendor_name, u.name AS created_by_name
       FROM purchase_orders po
       JOIN vendors v ON v.id = po.vendor_id
       JOIN users u ON u.id = po.created_by
       ${where}
       ORDER BY po.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
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

export async function getPO(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const po = await query(
      `SELECT po.*, v.name AS vendor_name, v.email AS vendor_email, v.phone AS vendor_phone
       FROM purchase_orders po JOIN vendors v ON v.id = po.vendor_id
       WHERE po.id = $1`,
      [req.params.id]
    );
    if (!po.rows[0]) throw createError('PO not found', 404);

    const items = await query(
      `SELECT pi.*, i.item_code, i.material_name, i.unit
       FROM po_items pi JOIN inventory i ON i.id = pi.inventory_id
       WHERE pi.po_id = $1`,
      [req.params.id]
    );

    res.json({ success: true, data: { ...po.rows[0], items: items.rows } });
  } catch (err) { next(err); }
}

export async function updatePOStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status } = req.body;
    const allowed = ['draft', 'sent', 'confirmed', 'partially_delivered', 'delivered', 'cancelled'];
    if (!allowed.includes(status)) throw createError('Invalid status');

    const result = await query(
      'UPDATE purchase_orders SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    if (!result.rows[0]) throw createError('PO not found', 404);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
}
