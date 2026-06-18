import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../../config/database';
import { AuthenticatedRequest, Inspection } from '../../types';
import { AppError } from '../../middleware/errorHandler';

export async function listInspections(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(100, parseInt(String(req.query.limit || '20'), 10));
    const offset = (page - 1) * limit;

    const { rows } = await query<Inspection & { inspector_name: string; grn_number: string }>(
      `SELECT i.*, u.name AS inspector_name, g.grn_number
       FROM inspections i
       JOIN users u ON u.id = i.inspector_id
       JOIN grns g ON g.id = i.grn_id
       ORDER BY i.inspected_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await query<{ count: string }>('SELECT COUNT(*) as count FROM inspections');
    const total = parseInt(countResult.rows[0].count, 10);

    res.status(200).json({
      success: true, data: rows,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
}

export async function getInspectionById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rows } = await query<Inspection & { inspector_name: string; grn_number: string }>(
      `SELECT i.*, u.name AS inspector_name, g.grn_number
       FROM inspections i
       JOIN users u ON u.id = i.inspector_id
       JOIN grns g ON g.id = i.grn_id
       WHERE i.id = $1`,
      [req.params.id]
    );

    if (rows.length === 0) throw new AppError('Inspection not found.', 404, 'NOT_FOUND');
    res.status(200).json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
}

export async function createInspection(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ success: false, errors: errors.array() }); return; }

    const { grn_id, test_certificates_ok, po_compliance_ok, physical_condition, result, remarks } =
      req.body as Inspection;

    const id = uuidv4();

    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO inspections
           (id, grn_id, inspector_id, test_certificates_ok, po_compliance_ok, physical_condition, result, remarks)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [id, grn_id, req.user?.sub, test_certificates_ok, po_compliance_ok, physical_condition ?? null, result, remarks ?? null]
      );

      // Update GRN status to inspected
      await client.query(
        "UPDATE grns SET status = 'inspected' WHERE id = $1",
        [grn_id]
      );
    });

    const { rows } = await query<Inspection>('SELECT * FROM inspections WHERE id = $1', [id]);
    res.status(201).json({ success: true, data: rows[0], message: 'Inspection record created.' });
  } catch (err) { next(err); }
}
