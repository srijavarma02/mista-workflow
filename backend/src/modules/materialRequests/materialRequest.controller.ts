import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../../config/database';
import { AuthenticatedRequest, MaterialRequest } from '../../types';
import { AppError } from '../../middleware/errorHandler';

export async function listMaterialRequests(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(100, parseInt(String(req.query.limit || '20'), 10));
    const offset = (page - 1) * limit;
    const status = String(req.query.status || '');
    const priority = String(req.query.priority || '');
    const projectId = String(req.query.project_id || '');

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (status)    { conditions.push(`mr.status = $${idx++}`);     params.push(status); }
    if (priority)  { conditions.push(`mr.priority = $${idx++}`);   params.push(priority); }
    if (projectId) { conditions.push(`mr.project_id = $${idx++}`); params.push(projectId); }

    // Non-admin users only see their own requests
    if (req.user?.role === 'site_engineer') {
      conditions.push(`mr.requester_id = $${idx++}`);
      params.push(req.user.sub);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM material_requests mr ${where}`,
      params
    );

    params.push(limit, offset);
    const { rows } = await query<MaterialRequest & { requester_name: string; project_name: string }>(
      `SELECT mr.*, u.name AS requester_name, p.name AS project_name
       FROM material_requests mr
       JOIN users u ON u.id = mr.requester_id
       JOIN projects p ON p.id = mr.project_id
       ${where}
       ORDER BY mr.created_at DESC
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

export async function getMaterialRequestById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { rows } = await query<MaterialRequest & { requester_name: string; project_name: string }>(
      `SELECT mr.*, u.name AS requester_name, p.name AS project_name
       FROM material_requests mr
       JOIN users u ON u.id = mr.requester_id
       JOIN projects p ON p.id = mr.project_id
       WHERE mr.id = $1`,
      [req.params.id]
    );

    if (rows.length === 0) throw new AppError('Material request not found.', 404, 'NOT_FOUND');
    res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function createMaterialRequest(
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

    const { project_id, material_name, quantity, unit, required_date, priority, remarks } =
      req.body as MaterialRequest;

    const id = uuidv4();
    const requestNumber = `MR-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000) + 10000)}`;

    await query(
      `INSERT INTO material_requests
         (id, request_number, project_id, requester_id, material_name, quantity, unit, required_date, priority, remarks, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending')`,
      [id, requestNumber, project_id, req.user?.sub, material_name, quantity, unit, required_date, priority || 'medium', remarks ?? null]
    );

    const { rows } = await query<MaterialRequest>('SELECT * FROM material_requests WHERE id = $1', [id]);
    res.status(201).json({ success: true, data: rows[0], message: 'Material request created.' });
  } catch (err) {
    next(err);
  }
}

export async function updateMaterialRequest(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const existing = await query<MaterialRequest>('SELECT * FROM material_requests WHERE id = $1', [id]);

    if (existing.rows.length === 0) throw new AppError('Material request not found.', 404, 'NOT_FOUND');

    const mr = existing.rows[0];
    if (!['draft', 'pending'].includes(mr.status)) {
      throw new AppError('Only draft or pending requests can be updated.', 400, 'INVALID_STATE');
    }

    const { material_name, quantity, unit, required_date, priority, remarks } =
      req.body as Partial<MaterialRequest>;

    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (material_name)   { updates.push(`material_name = $${idx++}`);   params.push(material_name); }
    if (quantity)        { updates.push(`quantity = $${idx++}`);        params.push(quantity); }
    if (unit)            { updates.push(`unit = $${idx++}`);            params.push(unit); }
    if (required_date)   { updates.push(`required_date = $${idx++}`);   params.push(required_date); }
    if (priority)        { updates.push(`priority = $${idx++}`);        params.push(priority); }
    if (remarks !== undefined) { updates.push(`remarks = $${idx++}`);   params.push(remarks); }

    if (updates.length === 0) {
      res.status(400).json({ success: false, message: 'No fields to update.' });
      return;
    }

    updates.push('updated_at = NOW()');
    params.push(id);

    await query(`UPDATE material_requests SET ${updates.join(', ')} WHERE id = $${idx}`, params);

    const { rows } = await query<MaterialRequest>('SELECT * FROM material_requests WHERE id = $1', [id]);
    res.status(200).json({ success: true, data: rows[0], message: 'Material request updated.' });
  } catch (err) {
    next(err);
  }
}

export async function approveMaterialRequest(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { remarks } = req.body as { remarks?: string };

    await withTransaction(async (client) => {
      const result = await client.query<MaterialRequest>(
        "SELECT * FROM material_requests WHERE id = $1 AND status = 'pending' FOR UPDATE",
        [id]
      );

      if (result.rows.length === 0) {
        throw new AppError('Material request not found or not in pending status.', 404, 'NOT_FOUND');
      }

      await client.query(
        "UPDATE material_requests SET status = 'approved', updated_at = NOW() WHERE id = $1",
        [id]
      );

      await client.query(
        `INSERT INTO approvals (id, entity_type, entity_id, approver_id, status, remarks)
         VALUES ($1, 'material_request', $2, $3, 'approved', $4)`,
        [uuidv4(), id, req.user?.sub, remarks ?? null]
      );
    });

    res.status(200).json({ success: true, message: 'Material request approved.' });
  } catch (err) {
    next(err);
  }
}

export async function rejectMaterialRequest(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { remarks } = req.body as { remarks: string };

    await withTransaction(async (client) => {
      const result = await client.query<MaterialRequest>(
        "SELECT * FROM material_requests WHERE id = $1 AND status = 'pending' FOR UPDATE",
        [id]
      );

      if (result.rows.length === 0) {
        throw new AppError('Material request not found or not in pending status.', 404, 'NOT_FOUND');
      }

      await client.query(
        "UPDATE material_requests SET status = 'rejected', updated_at = NOW() WHERE id = $1",
        [id]
      );

      await client.query(
        `INSERT INTO approvals (id, entity_type, entity_id, approver_id, status, remarks)
         VALUES ($1, 'material_request', $2, $3, 'rejected', $4)`,
        [uuidv4(), id, req.user?.sub, remarks]
      );
    });

    res.status(200).json({ success: true, message: 'Material request rejected.' });
  } catch (err) {
    next(err);
  }
}

export async function cancelMaterialRequest(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const { rowCount } = await query(
      "UPDATE material_requests SET status = 'cancelled', updated_at = NOW() WHERE id = $1 AND status IN ('draft','pending')",
      [id]
    );

    if (!rowCount || rowCount === 0) {
      throw new AppError('Request not found or cannot be cancelled in its current state.', 400, 'INVALID_STATE');
    }

    res.status(200).json({ success: true, message: 'Material request cancelled.' });
  } catch (err) {
    next(err);
  }
}
