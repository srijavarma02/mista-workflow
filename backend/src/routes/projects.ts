import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { createError } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();
router.use(authenticate);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT p.*, u.name AS manager_name
       FROM projects p LEFT JOIN users u ON u.id = p.manager_id
       WHERE p.status != 'cancelled'
       ORDER BY p.name`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

router.post('/', authorize('admin','project_manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, code, location, manager_id, start_date, end_date, budget } = req.body;
    if (!name || !code) throw createError('name and code are required');
    const result = await query(
      `INSERT INTO projects (name, code, location, manager_id, start_date, end_date, budget)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, code, location||null, manager_id||null, start_date||null, end_date||null, budget||null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

router.put('/:id', authorize('admin','project_manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allowed = ['name','location','status','manager_id','start_date','end_date','budget'];
    const updates: string[] = [];
    const values: unknown[] = [];
    Object.entries(req.body).forEach(([k,v]) => {
      if (allowed.includes(k)) { values.push(v); updates.push(`${k}=$${values.length}`); }
    });
    if (!updates.length) throw createError('No valid fields');
    values.push(req.params.id);
    const result = await query(
      `UPDATE projects SET ${updates.join(',')} WHERE id=$${values.length} RETURNING *`,
      values
    );
    if (!result.rows[0]) throw createError('Project not found', 404);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

export default router;
