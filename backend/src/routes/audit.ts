import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { query } from '../config/database';

const router = Router();
router.use(authenticate, authorize('admin'));

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entity_type, user_id, page = '1', limit = '50' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    const params: unknown[] = [];
    const conds: string[] = [];

    if (entity_type) { params.push(entity_type); conds.push(`al.entity_type=$${params.length}`); }
    if (user_id) { params.push(user_id); conds.push(`al.user_id=$${params.length}`); }

    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    params.push(parseInt(limit as string), offset);

    const result = await query(
      `SELECT al.*, u.name AS user_name, u.email AS user_email
       FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

export default router;
