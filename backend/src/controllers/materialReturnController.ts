import { Request, Response, NextFunction } from 'express';
import { query, getClient } from '../config/database';
import { createError } from '../middleware/errorHandler';
import { nextNumber } from '../services/sequenceService';
import { adjustStock } from '../services/inventoryService';

export async function createReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { issue_id, project_id, reason, condition, items } = req.body;
    if (!items?.length) throw createError('items are required');

    const return_number = await nextNumber('material_return');
    const client = await getClient();
    try {
      await client.query('BEGIN');

      const retRes = await client.query(
        `INSERT INTO material_returns
           (return_number, issue_id, project_id, returned_by, reason, condition, status)
         VALUES ($1,$2,$3,$4,$5,$6,'pending') RETURNING *`,
        [return_number, issue_id || null, project_id || null,
         req.user!.userId, reason || null, condition || null]
      );

      for (const item of items as Array<{ inventory_id: string; quantity_returned: number }>) {
        await client.query(
          `INSERT INTO return_items (return_id, inventory_id, quantity_returned)
           VALUES ($1,$2,$3)`,
          [retRes.rows[0].id, item.inventory_id, item.quantity_returned]
        );
      }

      await client.query('COMMIT');
      res.status(201).json({ success: true, data: retRes.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
}

export async function acceptReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ret = await query<{ id: string; status: string; return_number: string }>(
      'SELECT * FROM material_returns WHERE id = $1',
      [req.params.id]
    );
    if (!ret.rows[0]) throw createError('Return not found', 404);
    if (ret.rows[0].status !== 'pending') throw createError('Return is not in pending state');

    const items = await query<{ inventory_id: string; quantity_returned: number }>(
      'SELECT * FROM return_items WHERE return_id = $1',
      [req.params.id]
    );

    const client = await getClient();
    try {
      await client.query('BEGIN');
      for (const item of items.rows) {
        await adjustStock(
          item.inventory_id,
          item.quantity_returned,
          'return',
          'material_return',
          req.params.id,
          req.user!.userId,
          `Return Note ${ret.rows[0].return_number}`,
          client
        );
      }
      await client.query(
        'UPDATE material_returns SET status = $1, received_by = $2 WHERE id = $3',
        ['received', req.user!.userId, req.params.id]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json({ success: true, message: 'Return accepted and stock updated' });
  } catch (err) { next(err); }
}

export async function getReturns(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    const params: unknown[] = [];
    const conds: string[] = [];

    if (status) { params.push(status); conds.push(`mr.status = $${params.length}`); }

    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const countRes = await query(`SELECT COUNT(*) FROM material_returns mr ${where}`, params);
    params.push(parseInt(limit as string), offset);

    const dataRes = await query(
      `SELECT mr.*, u.name AS returned_by_name
       FROM material_returns mr
       JOIN users u ON u.id = mr.returned_by
       ${where}
       ORDER BY mr.created_at DESC
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
