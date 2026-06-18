import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../../config/database';
import { AuthenticatedRequest, PurchaseOrder, POItem } from '../../types';
import { AppError } from '../../middleware/errorHandler';

export async function listPurchaseOrders(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(100, parseInt(String(req.query.limit || '20'), 10));
    const offset = (page - 1) * limit;
    const status = String(req.query.status || '');
    const vendorId = String(req.query.vendor_id || '');

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (status)   { conditions.push(`po.status = $${idx++}`);    params.push(status); }
    if (vendorId) { conditions.push(`po.vendor_id = $${idx++}`); params.push(vendorId); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM purchase_orders po ${where}`, params
    );

    params.push(limit, offset);
    const { rows } = await query<PurchaseOrder & { vendor_name: string; creator_name: string }>(
      `SELECT po.*, v.name AS vendor_name, u.name AS creator_name
       FROM purchase_orders po
       JOIN vendors v ON v.id = po.vendor_id
       JOIN users u ON u.id = po.created_by
       ${where}
       ORDER BY po.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    const total = parseInt(countResult.rows[0].count, 10);
    res.status(200).json({
      success: true, data: rows,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
}

export async function getPurchaseOrderById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rows } = await query<PurchaseOrder & { vendor_name: string }>(
      `SELECT po.*, v.name AS vendor_name
       FROM purchase_orders po
       JOIN vendors v ON v.id = po.vendor_id
       WHERE po.id = $1`,
      [req.params.id]
    );

    if (rows.length === 0) throw new AppError('Purchase order not found.', 404, 'NOT_FOUND');

    const { rows: items } = await query<POItem & { material_name: string }>(
      `SELECT pi.*, i.material_name, i.unit
       FROM po_items pi
       LEFT JOIN inventory i ON i.id = pi.inventory_id
       WHERE pi.po_id = $1`,
      [req.params.id]
    );

    res.status(200).json({ success: true, data: { ...rows[0], items } });
  } catch (err) { next(err); }
}

export async function createPurchaseOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ success: false, errors: errors.array() }); return; }

    const { vendor_id, delivery_date, items } = req.body as {
      vendor_id: string;
      delivery_date?: string;
      items: Array<{ inventory_id?: string; quantity: number; unit_price: number }>;
    };

    const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const poId = uuidv4();
    const poNumber = `PO-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000) + 10000)}`;

    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO purchase_orders (id, po_number, vendor_id, status, total_amount, delivery_date, created_by)
         VALUES ($1,$2,$3,'draft',$4,$5,$6)`,
        [poId, poNumber, vendor_id, totalAmount, delivery_date ?? null, req.user?.sub]
      );

      for (const item of items) {
        await client.query(
          `INSERT INTO po_items (id, po_id, inventory_id, quantity, unit_price)
           VALUES ($1,$2,$3,$4,$5)`,
          [uuidv4(), poId, item.inventory_id ?? null, item.quantity, item.unit_price]
        );
      }
    });

    const { rows } = await query<PurchaseOrder>('SELECT * FROM purchase_orders WHERE id = $1', [poId]);
    res.status(201).json({ success: true, data: rows[0], message: 'Purchase order created.' });
  } catch (err) { next(err); }
}

export async function updatePurchaseOrderStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ success: false, errors: errors.array() }); return; }

    const { id } = req.params;
    const { status } = req.body as { status: string };

    const { rowCount } = await query(
      'UPDATE purchase_orders SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, id]
    );

    if (!rowCount || rowCount === 0) throw new AppError('Purchase order not found.', 404, 'NOT_FOUND');
    res.status(200).json({ success: true, message: `Purchase order status updated to ${status}.` });
  } catch (err) { next(err); }
}

export async function addPOItem(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ success: false, errors: errors.array() }); return; }

    const { id } = req.params;
    const { inventory_id, quantity, unit_price } = req.body as POItem;

    // Verify PO exists and is in a state where items can be added
    const poResult = await query<PurchaseOrder>(
      "SELECT * FROM purchase_orders WHERE id = $1 AND status = 'draft'",
      [id]
    );

    if (poResult.rows.length === 0) {
      throw new AppError('Purchase order not found or not in draft status.', 400, 'INVALID_STATE');
    }

    const itemId = uuidv4();
    await withTransaction(async (client) => {
      await client.query(
        'INSERT INTO po_items (id, po_id, inventory_id, quantity, unit_price) VALUES ($1,$2,$3,$4,$5)',
        [itemId, id, inventory_id ?? null, quantity, unit_price]
      );

      // Recalculate total
      await client.query(
        `UPDATE purchase_orders
         SET total_amount = (SELECT SUM(quantity * unit_price) FROM po_items WHERE po_id = $1), updated_at = NOW()
         WHERE id = $1`,
        [id]
      );
    });

    res.status(201).json({ success: true, message: 'Item added to purchase order.' });
  } catch (err) { next(err); }
}
