import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { createError } from '../middleware/errorHandler';

export async function getVendors(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { search, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    const params: unknown[] = [];
    const conds = ['is_active = true'];

    if (search) {
      params.push(`%${search}%`);
      conds.push(`(name ILIKE $${params.length} OR contact_person ILIKE $${params.length})`);
    }

    const where = 'WHERE ' + conds.join(' AND ');
    const countRes = await query(`SELECT COUNT(*) FROM vendors ${where}`, params);
    params.push(parseInt(limit as string), offset);

    const dataRes = await query(
      `SELECT * FROM vendors ${where} ORDER BY name LIMIT $${params.length - 1} OFFSET $${params.length}`,
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

export async function createVendor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, contact_person, email, phone, address, gst_number } = req.body;
    if (!name) throw createError('Vendor name is required');

    const result = await query(
      `INSERT INTO vendors (name, contact_person, email, phone, address, gst_number)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, contact_person || null, email || null, phone || null, address || null, gst_number || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
}

export async function updateVendor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const allowed = ['name','contact_person','email','phone','address','gst_number','performance_score','is_active'];
    const updates: string[] = [];
    const values: unknown[] = [];

    Object.entries(req.body).forEach(([key, val]) => {
      if (allowed.includes(key)) { values.push(val); updates.push(`${key} = $${values.length}`); }
    });

    if (!updates.length) throw createError('No valid fields');
    values.push(req.params.id);
    const result = await query(
      `UPDATE vendors SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!result.rows[0]) throw createError('Vendor not found', 404);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
}

export async function getVendorPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await query(
      `SELECT v.id, v.name, v.performance_score,
              COUNT(DISTINCT po.id) AS total_orders,
              COUNT(DISTINCT CASE WHEN po.status = 'delivered' THEN po.id END) AS delivered_orders,
              AVG(EXTRACT(DAY FROM g.received_date - po.created_at::date)) AS avg_delivery_days
       FROM vendors v
       LEFT JOIN purchase_orders po ON po.vendor_id = v.id
       LEFT JOIN grns g ON g.po_id = po.id
       WHERE v.is_active = true
       GROUP BY v.id, v.name, v.performance_score
       ORDER BY v.performance_score DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
}
