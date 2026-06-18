import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { createError } from '../middleware/errorHandler';
import { JwtPayload, UserRole } from '../types';

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw createError('Email and password are required');

    const result = await query<{
      id: string; name: string; email: string;
      password_hash: string; role: UserRole; is_active: boolean;
    }>(
      'SELECT id, name, email, password_hash, role, is_active FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    const user = result.rows[0];
    if (!user || !user.is_active) throw createError('Invalid credentials', 401);

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) throw createError('Invalid credentials', 401);

    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const payload: JwtPayload = { userId: user.id, email: user.email, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET as string, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });

    res.json({
      success: true,
      data: { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } },
    });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await query<{
      id: string; name: string; email: string; role: string;
      department: string; phone: string; created_at: string;
    }>(
      'SELECT id, name, email, role, department, phone, created_at FROM users WHERE id = $1',
      [req.user!.userId]
    );
    if (!result.rows[0]) throw createError('User not found', 404);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) throw createError('Both passwords required');
    if (newPassword.length < 8) throw createError('New password must be at least 8 characters');

    const result = await query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user!.userId]
    );
    const match = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!match) throw createError('Current password is incorrect');

    const hash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user!.userId]);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
}
