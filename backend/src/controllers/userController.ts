import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/database';
import { createError } from '../middleware/errorHandler';
import { UserRole } from '../types';

const VALID_ROLES: UserRole[] = [
  'admin','site_engineer','project_manager','stores_executive','procurement','qaqc','finance',
];

export async function getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await query(
      'SELECT id, name, email, role, department, phone, is_active, last_login, created_at FROM users ORDER BY name'
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
}

export async function createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, email, password, role, department, phone } = req.body;
    if (!name || !email || !password || !role) throw createError('name, email, password, role are required');
    if (!VALID_ROLES.includes(role)) throw createError(`Invalid role. Valid: ${VALID_ROLES.join(', ')}`);
    if (password.length < 8) throw createError('Password must be at least 8 characters');

    const hash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO users (name, email, password_hash, role, department, phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, role, department, phone, is_active, created_at`,
      [name, email.toLowerCase(), hash, role, department || null, phone || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
}

export async function updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const allowed = ['name','role','department','phone','is_active'];
    const updates: string[] = [];
    const values: unknown[] = [];

    Object.entries(req.body).forEach(([key, val]) => {
      if (allowed.includes(key)) { values.push(val); updates.push(`${key} = $${values.length}`); }
    });

    if (!updates.length) throw createError('No valid fields');
    values.push(req.params.id);
    const result = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${values.length}
       RETURNING id, name, email, role, department, phone, is_active`,
      values
    );
    if (!result.rows[0]) throw createError('User not found', 404);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
}
