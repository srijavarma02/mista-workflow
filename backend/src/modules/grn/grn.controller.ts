import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../../config/database';
import { AuthenticatedRequest, GRN, GRNItem, InventoryItem } from '../../types';
import { AppError } from '../../middleware/errorHandler';

export async function listGRNs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(100, parseInt(String(req.query.limit || '20'), 10));
    const offset = (page - 1) * limit;
    const status = String(req.query.status || '');

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (status) { conditions.push(`g.status = $${idx++}`); params.push(status); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM grns g ${where}`, params
    );

    params.push(limit, offset);
    const { rows } = await query<GRN & { po_number: string; received_by_name: string }>(
      `SELECT g.*, po.po_number, u.name AS received_by_name
       FROM grns g
       JOIN purchase_orders po ON po.id = g.po_id
       JOIN users u ON u.id = g.received_by
       ${where}
       ORDER BY g.created_at DESC
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

export async function getGRNById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rows } = await query<GRN & { po_number: string }>(
      `SELECT g.*, po.po_number FROM grns g JOIN purchase_orders po ON po.id = g.po_id WHERE g.id = $1`,
      [req.params.id]
    );

    if (rows.length === 0) throw new AppError('GRN not found.', 404, 'NOT_FOUND');

    const { rows: items } = await query<GRNItem & { material_name: string }>(
      `SELECT gi.*, i.material_name, i.unit
       FROM grn_items gi
       JOIN po_items pi ON pi.id = gi.po_item_id
       LEFT JOIN inventory i ON i.id = pi.inventory_id
       WHERE gi.grn_id = $1`,
      [req.params.id]
    );

    res.status(200).json({ success: true, data: { ...rows[0], items } });
  } catch (err) { next(err); }
}

export async function createGRN(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ success: false, errors: errors.array() }); return; }

    const { po_id, received_date, items } = req.body as {
      po_id: string;
      received_date: string;
      items: Array<{
        po_item_id: string;
        quantity_received: number;
        quantity_accepted: number;
        quantity_rejected: number;
      }>;
    };

    const grnId = uuidv4();
    const grnNumber = `GRN-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000) + 10000)}`;

    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO grns (id, grn_number, po_id, received_by, received_date, status)
         VALUES ($1,$2,$3,$4,$5,'pending_inspection')`,
        [grnId, grnNumber, po_id, req.user?.sub, received_date]
      );

      for (const item of items) {
        await client.query(
          `INSERT INTO grn_items (id, grn_id, po_item_id, quantity_received, quantity_accepted, quantity_rejected)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [uuidv4(), grnId, item.po_item_id, item.quantity_received, item.quantity_accepted, item.quantity_rejected]
        );
      }

      // Update PO status to partially_received
      await client.query(
        "UPDATE purchase_orders SET status = 'partially_received', updated_at = NOW() WHERE id = $1",
        [po_id]
      );
    });

    const { rows } = await query<GRN>('SELECT * FROM grns WHERE id = $1', [grnId]);
    res.status(201).json({ success: true, data: rows[0], message: 'GRN created successfully.' });
  } catch (err) { next(err); }
}

export async function updateGRNStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ success: false, errors: errors.array() }); return; }

    const { id } = req.params;
    const { status } = req.body as { status: string };

    await withTransaction(async (client) => {
      const result = await client.query<GRN>(
        'SELECT * FROM grns WHERE id = $1 FOR UPDATE', [id]
      );

      if (result.rows.length === 0) throw new AppError('GRN not found.', 404, 'NOT_FOUND');

      await client.query('UPDATE grns SET status = $1 WHERE id = $2', [status, id]);

      // When GRN is accepted, update inventory stock
      if (status === 'accepted') {
        const grnItems = await client.query<{
          inventory_id: string;
          quantity_accepted: number;
          available_qty: number;
        }>(
          `SELECT pi.inventory_id, gi.quantity_accepted, i.available_qty
           FROM grn_items gi
           JOIN po_items pi ON pi.id = gi.po_item_id
           JOIN inventory i ON i.id = pi.inventory_id
           WHERE gi.grn_id = $1 AND pi.inventory_id IS NOT NULL`,
          [id]
        );

        for (const item of grnItems.rows) {
          const newQty = item.available_qty + item.quantity_accepted;
          await client.query(
            'UPDATE inventory SET available_qty = $1, updated_at = NOW() WHERE id = $2',
            [newQty, item.inventory_id]
          );

          await client.query(
            `INSERT INTO stock_ledger
               (id, inventory_id, transaction_type, quantity, balance_after, reference_type, reference_id, created_by)
             VALUES ($1,$2,'receipt',$3,$4,'grn',$5,$6)`,
            [uuidv4(), item.inventory_id, item.quantity_accepted, newQty, id, req.user?.sub ?? null]
          );
        }
      }
    });

    res.status(200).json({ success: true, message: `GRN status updated to ${status}.` });
  } catch (err) { next(err); }
}

// Unused export to satisfy import in routes
export async function addGRNItem(_req: AuthenticatedRequest, res: Response): Promise<void> {
  res.status(501).json({ success: false, message: 'Use createGRN to add items.' });
}
