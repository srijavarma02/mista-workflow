import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../../config/database';
import { AuthenticatedRequest, User } from '../../types';
import { AppError } from '../../middleware/errorHandler';

export async function listUsers(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
    const offset = (page - 1) * limit;
    const search = String(req.query.search || '');
    const role = String(req.query.role || '');

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (search) {
      conditions.push(`(u.name ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx})`);
      params.push(`%${search}%`);
      paramIdx++;
    }
    if (role) {
      conditions.push(`u.role = $${paramIdx}`);
      params.push(role);
      paramIdx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM users u ${where}`,
      params
    );

    params.push(limit, offset);
    const { rows } = await query<Omit<User, 'password_hash'>>(
      `SELECT id, name, email, role, department, phone, is_active, created_at, updated_at
       FROM users u ${where}
       ORDER BY created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      params
    );

    const total = parseInt(countResult.rows[0].count, 10);
    res.status(200).json({
      success: true,
      data: rows,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

export async function getUserById(
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

    const { rows } = await query<Omit<User, 'password_hash'>>(
      `SELECT id, name, email, role, department, phone, is_active, created_at, updated_at
       FROM users WHERE id = $1`,
      [req.params.id]
    );

    if (rows.length === 0) throw new AppError('User not found.', 404, 'NOT_FOUND');
    res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function createUser(
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

    const { name, email, password, role, department, phone } = req.body as {
      name: string; email: string; password: string;
      role: string; department?: string; phone?: string;
    };

    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      throw new AppError('A user with this email already exists.', 409, 'CONFLICT');
    }

    const hash = await bcrypt.hash(password, 12);
    const id = uuidv4();

    await query(
      `INSERT INTO users (id, name, email, password_hash, role, department, phone, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)`,
      [id, name, email.toLowerCase(), hash, role, department ?? null, phone ?? null]
    );

    const { rows } = await query<Omit<User, 'password_hash'>>(
      'SELECT id, name, email, role, department, phone, is_active, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );

    res.status(201).json({ success: true, data: rows[0], message: 'User created successfully.' });
  } catch (err) {
    next(err);
  }
}

export async function updateUser(
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

    const { id } = req.params;
    const { name, role, department, phone } = req.body as {
      name?: string; role?: string; department?: string; phone?: string;
    };

    const existing = await query<User>('SELECT * FROM users WHERE id = $1', [id]);
    if (existing.rows.length === 0) throw new AppError('User not found.', 404, 'NOT_FOUND');

    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (name)       { updates.push(`name = $${idx++}`);       params.push(name); }
    if (role)       { updates.push(`role = $${idx++}`);       params.push(role); }
    if (department !== undefined) { updates.push(`department = $${idx++}`); params.push(department); }
    if (phone !== undefined)      { updates.push(`phone = $${idx++}`);      params.push(phone); }

    if (updates.length === 0) {
      res.status(400).json({ success: false, message: 'No fields to update.' });
      return;
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    await query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`, params);

    const { rows } = await query<Omit<User, 'password_hash'>>(
      'SELECT id, name, email, role, department, phone, is_active, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );

    res.status(200).json({ success: true, data: rows[0], message: 'User updated successfully.' });
  } catch (err) {
    next(err);
  }
}

export async function deactivateUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    if (id === req.user?.sub) {
      throw new AppError('You cannot deactivate your own account.', 400, 'SELF_DEACTIVATION');
    }

    const { rowCount } = await query(
      'UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND is_active = TRUE',
      [id]
    );

    if (!rowCount || rowCount === 0) throw new AppError('User not found or already deactivated.', 404, 'NOT_FOUND');
    res.status(200).json({ success: true, message: 'User deactivated successfully.' });
  } catch (err) {
    next(err);
  }
}

export async function reactivateUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { rowCount } = await query(
      'UPDATE users SET is_active = TRUE, updated_at = NOW() WHERE id = $1 AND is_active = FALSE',
      [req.params.id]
    );

    if (!rowCount || rowCount === 0) throw new AppError('User not found or already active.', 404, 'NOT_FOUND');
    res.status(200).json({ success: true, message: 'User reactivated successfully.' });
  } catch (err) {
    next(err);
  }
}
