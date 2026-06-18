import { Request, Response, NextFunction } from 'express';
import { query, getClient } from '../config/database';
import { createError } from '../middleware/errorHandler';
import { nextNumber } from '../services/sequenceService';
import { adjustStock } from '../services/inventoryService';
import { sendNotification } from '../services/notificationService';

export async function createMaterialIssue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { material_request_id, project_id, received_by, items, remarks } = req.body;
    if (!received_by || !items?.length) throw createError('received_by and items are required');

    const issue_number = await nextNumber('material_issue');
    const client = await getClient();
    try {
      await client.query('BEGIN');

      const issueRes = await client.query(
        `INSERT INTO material_issues
           (issue_number, material_request_id, project_id, issued_by, received_by, remarks, status)
         VALUES ($1,$2,$3,$4,$5,$6,'pending') RETURNING *`,
        [issue_number, material_request_id || null, project_id || null,
         req.user!.userId, received_by, remarks || null]
      );

      for (const item of items as Array<{ inventory_id: string; quantity_requested: number }>) {
        await client.query(
          `INSERT INTO issue_items (issue_id, inventory_id, quantity_requested)
           VALUES ($1,$2,$3)`,
          [issueRes.rows[0].id, item.inventory_id, item.quantity_requested]
        );
      }

      await client.query('COMMIT');

      // Notify manager to approve
      const managers = await query<{ id: string; email: string }>(
        "SELECT id, email FROM users WHERE role = 'project_manager' AND is_active = true LIMIT 5"
      );
      for (const mgr of managers.rows) {
        await sendNotification({
          userId: mgr.id,
          userEmail: mgr.email,
          title: 'Material Issue Approval Required',
          message: `Issue Note ${issue_number} is pending your approval.`,
          type: 'info',
          channel: 'all',
          entityType: 'material_issue',
          entityId: issueRes.rows[0].id,
        });
      }

      res.status(201).json({ success: true, data: issueRes.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
}

export async function approveMaterialIssue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const issue = await query<{ id: string; status: string; issue_number: string }>(
      'SELECT * FROM material_issues WHERE id = $1',
      [req.params.id]
    );
    if (!issue.rows[0]) throw createError('Material issue not found', 404);
    if (issue.rows[0].status !== 'pending') throw createError('Issue is not in pending state');

    const items = await query<{ inventory_id: string; quantity_requested: number; id: string }>(
      'SELECT * FROM issue_items WHERE issue_id = $1',
      [req.params.id]
    );

    const client = await getClient();
    try {
      await client.query('BEGIN');

      for (const item of items.rows) {
        await adjustStock(
          item.inventory_id,
          -item.quantity_requested,
          'issue',
          'material_issue',
          req.params.id,
          req.user!.userId,
          `Issue Note ${issue.rows[0].issue_number}`,
          client
        );
        await client.query(
          'UPDATE issue_items SET quantity_issued = quantity_requested WHERE id = $1',
          [item.id]
        );
      }

      await client.query(
        'UPDATE material_issues SET status = $1, approved_by = $2, approved_at = NOW() WHERE id = $3',
        ['issued', req.user!.userId, req.params.id]
      );

      // Mark MRF as fulfilled if applicable
      await client.query(
        `UPDATE material_requests SET status = 'fulfilled'
         WHERE id = (SELECT material_request_id FROM material_issues WHERE id = $1)
           AND material_request_id IS NOT NULL`,
        [req.params.id]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json({ success: true, message: 'Material issued and stock updated' });
  } catch (err) { next(err); }
}

export async function getMaterialIssues(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, project_id, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    const params: unknown[] = [];
    const conds: string[] = [];

    if (status) { params.push(status); conds.push(`mi.status = $${params.length}`); }
    if (project_id) { params.push(project_id); conds.push(`mi.project_id = $${params.length}`); }

    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const countRes = await query(`SELECT COUNT(*) FROM material_issues mi ${where}`, params);
    params.push(parseInt(limit as string), offset);

    const dataRes = await query(
      `SELECT mi.*, u1.name AS issued_by_name, u2.name AS received_by_name,
              p.name AS project_name
       FROM material_issues mi
       JOIN users u1 ON u1.id = mi.issued_by
       JOIN users u2 ON u2.id = mi.received_by
       LEFT JOIN projects p ON p.id = mi.project_id
       ${where}
       ORDER BY mi.created_at DESC
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
