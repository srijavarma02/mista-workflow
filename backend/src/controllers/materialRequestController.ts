import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { createError } from '../middleware/errorHandler';
import { nextNumber } from '../services/sequenceService';
import { sendNotification, notifyRole } from '../services/notificationService';

export async function createMRF(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      project_id, material_master_id, inventory_id, quantity,
      required_date, priority = 'normal', remarks,
    } = req.body;

    if (!project_id || !material_master_id || !quantity || !required_date)
      throw createError('project_id, material_master_id, quantity, and required_date are required');

    const materialRes = await query(
      `SELECT mm.material_name, mm.material_code, mm.unit_of_measurement, mm.status
       FROM material_master mm
       WHERE mm.id = $1`,
      [material_master_id]
    );
    if (!materialRes.rows[0]) throw createError('Material master item not found', 404);
    if (materialRes.rows[0].status !== 'active') throw createError('Selected material is inactive', 400);

    const inventoryId = inventory_id || null;
    if (inventoryId) {
      const inventoryRes = await query(
        `SELECT id, available_qty, reserved_qty
         FROM inventory
         WHERE id = $1 AND material_master_id = $2`,
        [inventoryId, material_master_id]
      );
      if (!inventoryRes.rows[0]) throw createError('Inventory item not linked to selected material master', 400);
    }

    const request_number = await nextNumber('material_request');

    const result = await query(
      `INSERT INTO material_requests
         (request_number, project_id, requester_id, material_master_id, inventory_id, material_name, unit,
          quantity, required_date, priority, remarks, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'submitted') RETURNING *`,
      [
        request_number,
        project_id,
        req.user!.userId,
        material_master_id,
        inventoryId,
        materialRes.rows[0].material_name,
        materialRes.rows[0].unit_of_measurement,
        quantity,
        required_date,
        priority,
        remarks || null,
      ]
    );

    // Notify project manager
    const pm = await query<{ id: string; email: string }>(
      'SELECT u.id, u.email FROM users u JOIN projects p ON p.manager_id = u.id WHERE p.id = $1',
      [project_id]
    );
    if (pm.rows[0]) {
      await sendNotification({
        userId: pm.rows[0].id,
        userEmail: pm.rows[0].email,
        title: 'New Material Requisition',
        message: `MRF ${request_number} submitted for ${materialRes.rows[0].material_name} (${quantity} ${materialRes.rows[0].unit_of_measurement}). Please review.`,
        type: 'info',
        channel: 'all',
        entityType: 'material_request',
        entityId: result.rows[0].id,
      });
    }

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
}

export async function getMRFs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, project_id, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    const params: unknown[] = [];
    const conditions: string[] = [];

    // Site engineers only see their own requests
    if (req.user!.role === 'site_engineer') {
      params.push(req.user!.userId);
      conditions.push(`mr.requester_id = $${params.length}`);
    }
    if (status) { params.push(status); conditions.push(`mr.status = $${params.length}`); }
    if (project_id) { params.push(project_id); conditions.push(`mr.project_id = $${params.length}`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const countRes = await query(`SELECT COUNT(*) FROM material_requests mr ${where}`, params);

    params.push(parseInt(limit as string), offset);
    const dataRes = await query(
      `SELECT mr.*, u.name AS requester_name, p.name AS project_name, p.code AS project_code,
              mm.material_code, mm.category AS material_category, mm.unit_of_measurement,
              inv.available_qty AS current_stock, inv.reserved_qty, inv.id AS inventory_id
       FROM material_requests mr
       JOIN users u ON u.id = mr.requester_id
       JOIN projects p ON p.id = mr.project_id
       LEFT JOIN material_master mm ON mm.id = mr.material_master_id
       LEFT JOIN inventory inv ON inv.id = mr.inventory_id
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

export async function getMRF(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await query(
      `SELECT mr.*, u.name AS requester_name, p.name AS project_name, p.code AS project_code,
              mm.material_code, mm.category AS material_category, mm.unit_of_measurement,
              inv.available_qty AS current_stock, inv.reserved_qty, inv.id AS inventory_id
       FROM material_requests mr
       JOIN users u ON u.id = mr.requester_id
       JOIN projects p ON p.id = mr.project_id
       LEFT JOIN material_master mm ON mm.id = mr.material_master_id
       LEFT JOIN inventory inv ON inv.id = mr.inventory_id
       WHERE mr.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) throw createError('MRF not found', 404);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
}

export async function approveMRF(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { approved_quantity, remarks } = req.body;
    const mrf = await query<{
      id: string; status: string; requester_id: string; request_number: string;
      inventory_id: string; quantity: number; material_name: string;
    }>(
      'SELECT * FROM material_requests WHERE id = $1',
      [req.params.id]
    );

    if (!mrf.rows[0]) throw createError('MRF not found', 404);
    if (mrf.rows[0].status !== 'submitted') throw createError('MRF is not in submitted state');

    const item = mrf.rows[0];
    const approvedQty = approved_quantity !== undefined ? Number(approved_quantity) : item.quantity;
    if (Number.isNaN(approvedQty) || approvedQty <= 0) throw createError('approved_quantity must be a positive number');
    if (approvedQty > item.quantity) throw createError('approved_quantity cannot exceed requested quantity');

    await query('BEGIN');
    try {
      await query('UPDATE material_requests SET status = $1, approved_quantity = $2 WHERE id = $3',
        ['approved', approvedQty, req.params.id]);

      await query(
        `INSERT INTO approvals (entity_type, entity_id, approver_id, status, remarks)
         VALUES ('material_request', $1, $2, 'approved', $3)`,
        [req.params.id, req.user!.userId, remarks || null]
      );

      await query(
        `INSERT INTO mrf_approval_history
         (material_request_id, approver_id, requested_quantity, approved_quantity, status, remarks)
         VALUES ($1, $2, $3, $4, 'approved', $5)`,
        [req.params.id, req.user!.userId, item.quantity, approvedQty, remarks || null]
      );

      if (item.inventory_id) {
        const stock = await query<{ available_qty: number; reserved_qty: number; }>(
          'SELECT available_qty, reserved_qty FROM inventory WHERE id = $1 FOR UPDATE',
          [item.inventory_id]
        );
        const avail = stock.rows[0]?.available_qty ?? 0;
        const reserveQty = Math.min(avail, approvedQty);
        const shortageQty = approvedQty - reserveQty;

        if (reserveQty > 0) {
          await query(
            'UPDATE inventory SET available_qty = available_qty - $1, reserved_qty = reserved_qty + $1 WHERE id = $2',
            [reserveQty, item.inventory_id]
          );
          await query(
            `INSERT INTO stock_ledger
               (inventory_id, transaction_type, quantity, balance_after, reference_type, reference_id, created_by)
             VALUES ($1, 'reserved', $2, (SELECT available_qty FROM inventory WHERE id = $1), 'material_request', $3, $4)`,
            [item.inventory_id, reserveQty, req.params.id, req.user!.userId]
          );
        }

        if (shortageQty > 0) {
          const prNumber = await nextNumber('purchase_request');
          await query(
            `INSERT INTO purchase_requests
               (pr_number, material_request_id, inventory_id, quantity, unit, status, created_by)
             VALUES ($1, $2, $3, $4, $5, 'pending', $6)`,
            [prNumber, req.params.id, item.inventory_id, shortageQty, item.unit, req.user!.userId]
          );
          await notifyRole('procurement', {
            title: 'New Purchase Request',
            message: `Stock shortage for MRF ${item.request_number}. PR ${prNumber} created for ${shortageQty} ${item.unit}.`,
            type: 'warning',
            entityType: 'purchase_request',
          });
        }

        if (reserveQty > 0 && shortageQty === 0) {
          await notifyRole('stores_executive', {
            title: 'Material Ready to Issue',
            message: `MRF ${item.request_number} approved. ${reserveQty} ${item.unit} reserved for issuance.`,
            type: 'success',
            entityType: 'material_request',
          });
        }
      }

      await query('COMMIT');
    } catch (err) {
      await query('ROLLBACK');
      throw err;
    }

    const requester = await query<{ email: string }>('SELECT email FROM users WHERE id = $1', [item.requester_id]);
    if (requester.rows[0]) {
      await sendNotification({
        userId: item.requester_id,
        userEmail: requester.rows[0].email,
        title: 'MRF Approved',
        message: `Your material request ${item.request_number} has been approved. Approved quantity: ${approvedQty} ${item.unit}.`,
        type: 'success',
        channel: 'all',
        entityType: 'material_request',
        entityId: req.params.id,
      });
    }

    res.json({ success: true, message: 'MRF approved' });
  } catch (err) { next(err); }
}

export async function rejectMRF(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { remarks } = req.body;
    if (!remarks) throw createError('Rejection reason (remarks) is required');

    const mrf = await query<{ requester_id: string; request_number: string; status: string; quantity: number }>(
      'SELECT * FROM material_requests WHERE id = $1',
      [req.params.id]
    );
    if (!mrf.rows[0]) throw createError('MRF not found', 404);
    if (mrf.rows[0].status !== 'submitted') throw createError('MRF is not in submitted state');

    await query('BEGIN');
    try {
      await query('UPDATE material_requests SET status = $1 WHERE id = $2', ['rejected', req.params.id]);
      await query(
        `INSERT INTO approvals (entity_type, entity_id, approver_id, status, remarks)
         VALUES ('material_request', $1, $2, 'rejected', $3)`,
        [req.params.id, req.user!.userId, remarks]
      );
      await query(
        `INSERT INTO mrf_approval_history
         (material_request_id, approver_id, requested_quantity, approved_quantity, status, remarks)
         VALUES ($1, $2, $3, 0, 'rejected', $4)`,
        [req.params.id, req.user!.userId, mrf.rows[0].quantity, remarks]
      );
      await query('COMMIT');
    } catch (err) {
      await query('ROLLBACK');
      throw err;
    }

    const requester = await query<{ email: string }>(
      'SELECT email FROM users WHERE id = $1',
      [mrf.rows[0].requester_id]
    );
    if (requester.rows[0]) {
      await sendNotification({
        userId: mrf.rows[0].requester_id,
        userEmail: requester.rows[0].email,
        title: 'MRF Rejected',
        message: `Your material request ${mrf.rows[0].request_number} was rejected. Reason: ${remarks}`,
        type: 'error',
        channel: 'all',
        entityType: 'material_request',
        entityId: req.params.id,
      });
    }

    res.json({ success: true, message: 'MRF rejected' });
  } catch (err) { next(err); }
}
