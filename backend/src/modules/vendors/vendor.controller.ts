import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../../config/database';
import { AuthenticatedRequest, Vendor } from '../../types';
import { AppError } from '../../middleware/errorHandler';

export async function listVendors(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(100, parseInt(String(req.query.limit || '20'), 10));
    const offset = (page - 1) * limit;
    const search = String(req.query.search || '');
    const activeOnly = req.query.active !== 'false';

    const conditions: string[] = activeOnly ? ['is_active = TRUE'] : [];
    const params: unknown[] = [];
    let idx = 1;

    if (search) {
      conditions.push(`(name ILIKE $${idx} OR email ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query<{ count: string }>(`SELECT COUNT(*) as count FROM vendors ${where}`, params);
    params.push(limit, offset);

    const { rows } = await query<Vendor>(
      `SELECT * FROM vendors ${where} ORDER BY name ASC LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    const total = parseInt(countResult.rows[0].count, 10);
    res.status(200).json({
      success: true, data: rows,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
}

export async function getVendorById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rows } = await query<Vendor>('SELECT * FROM vendors WHERE id = $1', [req.params.id]);
    if (rows.length === 0) throw new AppError('Vendor not found.', 404, 'NOT_FOUND');
    res.status(200).json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
}

export async function createVendor(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ success: false, errors: errors.array() }); return; }

    const { name, contact_person, email, phone, address, performance_score } = req.body as Vendor;
    const id = uuidv4();

    await query(
      `INSERT INTO vendors (id, name, contact_person, email, phone, address, performance_score, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE)`,
      [id, name, contact_person ?? null, email ?? null, phone ?? null, address ?? null, performance_score ?? 5.0]
    );

    const { rows } = await query<Vendor>('SELECT * FROM vendors WHERE id = $1', [id]);
    res.status(201).json({ success: true, data: rows[0], message: 'Vendor created.' });
  } catch (err) { next(err); }
}

export async function updateVendor(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { name, contact_person, email, phone, address, performance_score } = req.body as Partial<Vendor>;

    const existing = await query<Vendor>('SELECT * FROM vendors WHERE id = $1', [id]);
    if (existing.rows.length === 0) throw new AppError('Vendor not found.', 404, 'NOT_FOUND');

    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (name)                        { updates.push(`name = $${idx++}`);              params.push(name); }
    if (contact_person !== undefined) { updates.push(`contact_person = $${idx++}`);   params.push(contact_person); }
    if (email !== undefined)          { updates.push(`email = $${idx++}`);            params.push(email); }
    if (phone !== undefined)          { updates.push(`phone = $${idx++}`);            params.push(phone); }
    if (address !== undefined)        { updates.push(`address = $${idx++}`);          params.push(address); }
    if (performance_score !== undefined) { updates.push(`performance_score = $${idx++}`); params.push(performance_score); }

    if (updates.length === 0) { res.status(400).json({ success: false, message: 'No fields to update.' }); return; }

    params.push(id);
    await query(`UPDATE vendors SET ${updates.join(', ')} WHERE id = $${idx}`, params);

    const { rows } = await query<Vendor>('SELECT * FROM vendors WHERE id = $1', [id]);
    res.status(200).json({ success: true, data: rows[0], message: 'Vendor updated.' });
  } catch (err) { next(err); }
}

export async function deactivateVendor(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rowCount } = await query(
      'UPDATE vendors SET is_active = FALSE WHERE id = $1 AND is_active = TRUE',
      [req.params.id]
    );
    if (!rowCount || rowCount === 0) throw new AppError('Vendor not found or already inactive.', 404, 'NOT_FOUND');
    res.status(200).json({ success: true, message: 'Vendor deactivated.' });
  } catch (err) { next(err); }
}
