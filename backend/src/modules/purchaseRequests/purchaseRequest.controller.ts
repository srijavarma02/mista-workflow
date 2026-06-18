import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../../config/database';
import { AuthenticatedRequest, PurchaseRequest } from '../../types';
import { AppError } from '../../middleware/errorHandler';

export async function listPurchaseRequests(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(100, parseInt(String(req.query.limit || '20'), 10));
    const offset = (page - 1) * limit;
    const status = String(req.query.status || '');

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (status) { conditions.push(`pr.status = $${idx++}`); params.push(status); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM purchase_requests pr ${where}`, params
    );

    params.push(limit, offset);
    const { rows } = await query<PurchaseRequest & { requester_name: string; material_name: string }>(
      `SELECT pr.*, u.name AS requester_name, mr.material_name
       FROM purchase_requests pr
       JOIN users u ON u.id = pr.created_by
       JOIN material_requests mr ON mr.id = pr.material_request_id
       ${where}
       ORDER BY pr.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    const total = parseInt(countResult.rows[0].count, 10);
    res.status(200).json({
      success: true, data: rows,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

export async function getPurchaseRequestById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { rows } = await query<PurchaseRequest>(
      `SELECT pr.*, u.name AS requester_name, mr.material_name
       FROM purchase_requests pr
       JOIN users u ON u.id = pr.created_by
       JOIN material_requests mr ON mr.id = pr.material_request_id
       WHERE pr.id = $1`,
      [req.params.id]
    );

    if (rows.length === 0) throw new AppError('Purchase request not found.', 404, 'NOT_FOUND');
    res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function createPurchaseRequest(
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

    const { material_request_id, inventory_id, quantity } = req.body as PurchaseRequest;
    const id = uuidv4();

    await query(
      `INSERT INTO purchase_requests (id, material_request_id, inventory_id, quantity, status, created_by)
       VALUES ($1,$2,$3,$4,'pending',$5)`,
      [id, material_request_id, inventory_id ?? null, quantity, req.user?.sub]
    );

    const { rows } = await query<PurchaseRequest>('SELECT * FROM purchase_requests WHERE id = $1', [id]);
    res.status(201).json({ success: true, data: rows[0], message: 'Purchase request created.' });
  } catch (err) {
    next(err);
  }
}

export async function approvePurchaseRequest(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await withTransaction(async (client) => {
      const result = await client.query<PurchaseRequest>(
        "SELECT * FROM purchase_requests WHERE id = $1 AND status = 'pending' FOR UPDATE",
        [req.params.id]
      );

      if (result.rows.length === 0)
        throw new AppError('Purchase request not found or not in pending status.', 404, 'NOT_FOUND');

      await client.query(
        "UPDATE purchase_requests SET status = 'approved' WHERE id = $1",
        [req.params.id]
      );

      await client.query(
        `INSERT INTO approvals (id, entity_type, entity_id, approver_id, status)
         VALUES ($1, 'purchase_request', $2, $3, 'approved')`,
        [uuidv4(), req.params.id, req.user?.sub]
      );
    });

    res.status(200).json({ success: true, message: 'Purchase request approved.' });
  } catch (err) {
    next(err);
  }
}

export async function rejectPurchaseRequest(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { remarks } = req.body as { remarks: string };

    await withTransaction(async (client) => {
      const result = await client.query<PurchaseRequest>(
        "SELECT * FROM purchase_requests WHERE id = $1 AND status = 'pending' FOR UPDATE",
        [req.params.id]
      );

      if (result.rows.length === 0)
        throw new AppError('Purchase request not found or not pending.', 404, 'NOT_FOUND');

      await client.query(
        "UPDATE purchase_requests SET status = 'rejected' WHERE id = $1",
        [req.params.id]
      );

      await client.query(
        `INSERT INTO approvals (id, entity_type, entity_id, approver_id, status, remarks)
         VALUES ($1, 'purchase_request', $2, $3, 'rejected', $4)`,
        [uuidv4(), req.params.id, req.user?.sub, remarks]
      );
    });

    res.status(200).json({ success: true, message: 'Purchase request rejected.' });
  } catch (err) {
    next(err);
  }
}
