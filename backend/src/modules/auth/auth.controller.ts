import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../../config/database';
import { AuthenticatedRequest, JwtPayload, User, TokenPair } from '../../types';
import { AppError } from '../../middleware/errorHandler';
import { writeAuditLog } from '../../middleware/audit';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

function generateTokens(user: User): TokenPair {
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);

  const refreshToken = jwt.sign({ sub: user.id }, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
  } as jwt.SignOptions);

  return { accessToken, refreshToken };
}

/**
 * POST /api/auth/login
 */
export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { email, password } = req.body as { email: string; password: string };

    const { rows } = await query<User>(
      'SELECT * FROM users WHERE email = $1 AND is_active = TRUE',
      [email.toLowerCase()]
    );

    if (rows.length === 0) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
      return;
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      await writeAuditLog({
        userId: null,
        action: 'LOGIN',
        entityType: 'user',
        entityId: user.id,
        newValue: { result: 'failed', email },
        ipAddress: req.ip,
      });
      res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
      return;
    }

    const tokens = generateTokens(user);

    await writeAuditLog({
      userId: user.id,
      action: 'LOGIN',
      entityType: 'user',
      entityId: user.id,
      newValue: { result: 'success' },
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          phone: user.phone,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/refresh
 */
export async function refreshToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { refreshToken: token } = req.body as { refreshToken: string };

    let decoded: { sub: string };
    try {
      decoded = jwt.verify(token, JWT_REFRESH_SECRET) as { sub: string };
    } catch {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token.',
        code: 'REFRESH_TOKEN_INVALID',
      });
      return;
    }

    const { rows } = await query<User>(
      'SELECT * FROM users WHERE id = $1 AND is_active = TRUE',
      [decoded.sub]
    );

    if (rows.length === 0) {
      res.status(401).json({ success: false, message: 'User not found or deactivated.' });
      return;
    }

    const tokens = generateTokens(rows[0]);

    res.status(200).json({
      success: true,
      data: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/logout
 */
export async function logout(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await writeAuditLog({
      userId: req.user?.sub ?? null,
      action: 'LOGOUT',
      entityType: 'user',
      entityId: req.user?.sub,
      ipAddress: req.ip,
    });

    res.status(200).json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/me
 */
export async function getMe(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { rows } = await query<User>(
      'SELECT id, name, email, role, department, phone, is_active, created_at, updated_at FROM users WHERE id = $1',
      [req.user?.sub]
    );

    if (rows.length === 0) {
      throw new AppError('User not found.', 404, 'NOT_FOUND');
    }

    res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/auth/change-password
 */
export async function changePassword(
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

    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };

    const { rows } = await query<User>('SELECT * FROM users WHERE id = $1', [
      req.user?.sub,
    ]);

    if (rows.length === 0) {
      throw new AppError('User not found.', 404, 'NOT_FOUND');
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      res.status(400).json({
        success: false,
        message: 'Current password is incorrect.',
      });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
      newHash,
      user.id,
    ]);

    await writeAuditLog({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'user',
      entityId: user.id,
      newValue: { action: 'password_changed' },
      ipAddress: req.ip,
    });

    res.status(200).json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    next(err);
  }
}
