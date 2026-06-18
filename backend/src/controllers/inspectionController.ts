import { Request, Response, NextFunction } from 'express';
import { query, getClient } from '../config/database';
import { createError } from '../middleware/errorHandler';
import { notifyRole, sendNotification } from '../services/notificationService';

export async function createInspection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      grn_id,
      test_certificates_ok,
      po_compliance_ok,
      physical_condition,
      result,
      remarks,
      item_results, // Array: [{ grn_item_id, quantity_accepted, quantity_rejected, rejection_reason }]
    } = req.body;

    if (!grn_id || !result) throw createError('grn_id and result are required');
    if (!['pass', 'fail'].includes(result)) throw createError('result must be pass or fail');

    const grn = await query<{ id: string; status: string; grn_number: string; po_id: string }>(
      'SELECT * FROM grns WHERE id = $1',
      [grn_id]
    );
    if (!grn.rows[0]) throw createError('GRN not found', 404);
    if (grn.rows[0].status !== 'pending') throw createError('GRN is not in pending state');

    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Create inspection record
      const inspRes = await client.query(
        `INSERT INTO inspections
           (grn_id, inspector_id, test_certificates_ok, po_compliance_ok,
            physical_condition, result, remarks)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [grn_id, req.user!.userId, test_certificates_ok ?? null,
         po_compliance_ok ?? null, physical_condition || null, result, remarks || null]
      );

      // Update GRN item accept/reject quantities
      if (item_results?.length) {
        for (const ir of item_results as Array<{
          grn_item_id: string;
          quantity_accepted: number;
          quantity_rejected: number;
          rejection_reason?: string;
        }>) {
          await client.query(
            `UPDATE grn_items
             SET quantity_accepted = $1, quantity_rejected = $2, rejection_reason = $3
             WHERE id = $4`,
            [ir.quantity_accepted, ir.quantity_rejected, ir.rejection_reason || null, ir.grn_item_id]
          );
        }
      }

      const newStatus = result === 'pass' ? 'inspected' : 'rejected';
      await client.query('UPDATE grns SET status = $1 WHERE id = $2', [newStatus, grn_id]);

      await client.query('COMMIT');

      if (result === 'fail') {
        // Notify procurement about rejection
        await notifyRole('procurement', {
          title: 'Inspection Failed – Replacement Required',
          message: `GRN ${grn.rows[0].grn_number} failed inspection. Remarks: ${remarks || 'N/A'}. Please arrange replacement.`,
          type: 'error',
          entityType: 'grn',
          entityId: grn_id,
        });
      } else {
        // Notify stores to update stock
        await notifyRole('stores_executive', {
          title: 'Inspection Passed – Ready for Stock Update',
          message: `GRN ${grn.rows[0].grn_number} passed inspection. Please finalise to update stock.`,
          type: 'success',
          entityType: 'grn',
          entityId: grn_id,
        });
      }

      res.status(201).json({ success: true, data: inspRes.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
}

export async function getInspection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await query(
      `SELECT ins.*, u.name AS inspector_name, g.grn_number
       FROM inspections ins
       JOIN users u ON u.id = ins.inspector_id
       JOIN grns g ON g.id = ins.grn_id
       WHERE ins.grn_id = $1`,
      [req.params.grnId]
    );
    res.json({ success: true, data: result.rows[0] || null });
  } catch (err) { next(err); }
}
