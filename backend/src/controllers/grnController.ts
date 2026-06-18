import { Request, Response, NextFunction } from 'express';
import { query, getClient } from '../config/database';
import { createError } from '../middleware/errorHandler';
import { nextNumber } from '../services/sequenceService';
import { adjustStock } from '../services/inventoryService';
import { notifyRole } from '../services/notificationService';

export async function createGRN(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { po_id, received_date, vehicle_no, driver_name, remarks, items } = req.body;
    if (!po_id || !items?.length) throw createError('po_id and items are required');

    const client = await getClient();
    try {
      await client.query('BEGIN');
      const grn_number = await nextNumber('grn');

      const grnRes = await client.query(
        `INSERT INTO grns (grn_number, po_id, received_by, received_date, vehicle_no, driver_name, remarks, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'pending') RETURNING *`,
        [grn_number, po_id, req.user!.userId, received_date || 'NOW()', vehicle_no || null, driver_name || null, remarks || null]
      );

      for (const item of items as Array<{ po_item_id: string; inventory_id: string; quantity_received: number }>) {
        await client.query(
          `INSERT INTO grn_items (grn_id, po_item_id, inventory_id, quantity_received)
           VALUES ($1,$2,$3,$4)`,
          [grnRes.rows[0].id, item.po_item_id, item.inventory_id, item.quantity_received]
        );
        // Update qty received in po_items
        await client.query(
          'UPDATE po_items SET quantity_received = quantity_received + $1 WHERE id = $2',
          [item.quantity_received, item.po_item_id]
        );
      }

      await client.query('COMMIT');

      // Notify QA/QC for inspection
      await notifyRole('qaqc', {
        title: 'Material Received – Inspection Required',
        message: `GRN ${grn_number} created. Please inspect the received materials.`,
        type: 'warning',
        entityType: 'grn',
        entityId: grnRes.rows[0].id,
      });
      await notifyRole('stores_executive', {
        title: 'Material Received',
        message: `GRN ${grn_number} recorded. Awaiting QA/QC inspection.`,
        type: 'info',
        entityType: 'grn',
        entityId: grnRes.rows[0].id,
      });

      res.status(201).json({ success: true, data: grnRes.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
}

export async function getGRNs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, po_id, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    const params: unknown[] = [];
    const conds: string[] = [];

    if (status) { params.push(status); conds.push(`g.status = $${params.length}`); }
    if (po_id) { params.push(po_id); conds.push(`g.po_id = $${params.length}`); }

    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const countRes = await query(`SELECT COUNT(*) FROM grns g ${where}`, params);
    params.push(parseInt(limit as string), offset);

    const dataRes = await query(
      `SELECT g.*, u.name AS received_by_name, po.po_number, v.name AS vendor_name
       FROM grns g
       JOIN users u ON u.id = g.received_by
       JOIN purchase_orders po ON po.id = g.po_id
       JOIN vendors v ON v.id = po.vendor_id
       ${where}
       ORDER BY g.created_at DESC
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

export async function getGRN(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const grn = await query(
      `SELECT g.*, po.po_number, v.name AS vendor_name, u.name AS received_by_name
       FROM grns g JOIN purchase_orders po ON po.id = g.po_id
       JOIN vendors v ON v.id = po.vendor_id
       JOIN users u ON u.id = g.received_by
       WHERE g.id = $1`,
      [req.params.id]
    );
    if (!grn.rows[0]) throw createError('GRN not found', 404);

    const items = await query(
      `SELECT gi.*, i.item_code, i.material_name, i.unit
       FROM grn_items gi JOIN inventory i ON i.id = gi.inventory_id
       WHERE gi.grn_id = $1`,
      [req.params.id]
    );

    const inspection = await query(
      'SELECT * FROM inspections WHERE grn_id = $1',
      [req.params.id]
    );

    res.json({
      success: true,
      data: { ...grn.rows[0], items: items.rows, inspection: inspection.rows[0] || null },
    });
  } catch (err) { next(err); }
}

export async function finaliseGRN(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Called after inspection is completed to update stock
    const grn = await query<{ id: string; status: string; grn_number: string }>(
      'SELECT * FROM grns WHERE id = $1',
      [req.params.id]
    );
    if (!grn.rows[0]) throw createError('GRN not found', 404);
    if (grn.rows[0].status !== 'inspected') throw createError('GRN must be in inspected state');

    const items = await query<{ inventory_id: string; quantity_accepted: number }>(
      'SELECT inventory_id, quantity_accepted FROM grn_items WHERE grn_id = $1',
      [req.params.id]
    );

    const client = await getClient();
    try {
      await client.query('BEGIN');
      for (const item of items.rows) {
        if (item.quantity_accepted > 0) {
          await adjustStock(
            item.inventory_id,
            item.quantity_accepted,
            'inward',
            'grn',
            req.params.id,
            req.user!.userId,
            `GRN ${grn.rows[0].grn_number}`,
            client
          );
        }
      }
      await client.query('UPDATE grns SET status = $1 WHERE id = $2', ['accepted', req.params.id]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json({ success: true, message: 'GRN finalised and stock updated' });
  } catch (err) { next(err); }
}
