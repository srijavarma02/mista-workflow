import { Router } from 'express';
import { body } from 'express-validator';
import {
  login,
  refreshToken,
  logout,
  getMe,
  changePassword,
} from './auth.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

/**
 * POST /api/auth/login
 * Authenticate with email + password, returns access + refresh tokens.
 */
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  login
);

/**
 * POST /api/auth/refresh
 * Exchange a valid refresh token for a new access token.
 */
router.post(
  '/refresh',
  [body('refreshToken').notEmpty().withMessage('Refresh token is required')],
  refreshToken
);

/**
 * POST /api/auth/logout
 * Invalidate the current session (client should discard tokens).
 */
router.post('/logout', authenticate, logout);

/**
 * GET /api/auth/me
 * Return the current authenticated user's profile.
 */
router.get('/me', authenticate, getMe);

/**
 * PUT /api/auth/change-password
 * Change the current user's password.
 */
router.put(
  '/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase, and a number'),
  ],
  changePassword
);

export default router;
