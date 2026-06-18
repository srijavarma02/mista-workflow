import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { createError } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();
router.use(authenticate);

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT inv.*, v.name AS vendor_name, po.po_number
       FROM invoices inv
       JOIN vendors v ON v.id = inv.vendor_id
       JOIN purchase_orders po ON po.id = inv.po_id
       ORDER BY inv.created_at DESC LIMIT 100`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

router.post('/', authorize('finance','admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { invoice_number, po_id, grn_id, vendor_id, amount, tax_amount, received_date, due_date, file_url } = req.body;
    if (!invoice_number || !po_id || !vendor_id || !amount) throw createError('invoice_number, po_id, vendor_id, amount required');
    const total = parseFloat(amount) + parseFloat(tax_amount || '0');
    const result = await query(
      `INSERT INTO invoices (invoice_number, po_id, grn_id, vendor_id, amount, tax_amount, total_amount, received_date, due_date, file_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [invoice_number, po_id, grn_id||null, vendor_id, amount, tax_amount||0, total, received_date||null, due_date||null, file_url||null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

router.put('/:id/status', authorize('finance','admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    const allowed = ['pending','verified','approved','paid','rejected'];
    if (!allowed.includes(status)) throw createError('Invalid status');
    const extra = status === 'paid' ? ', paid_date = NOW()' : '';
    const result = await query(
      `UPDATE invoices SET status=$1${extra}, verified_by=$2 WHERE id=$3 RETURNING *`,
      [status, req.user!.userId, req.params.id]
    );
    if (!result.rows[0]) throw createError('Invoice not found', 404);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

export default router;
