import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deactivateUser,
  reactivateUser,
} from './user.controller';
import { requireRoles } from '../../middleware/rbac';

const router = Router();

// GET /api/users
router.get('/', requireRoles('admin', 'store_manager'), listUsers);

// GET /api/users/:id
router.get(
  '/:id',
  [param('id').isUUID().withMessage('Invalid user ID')],
  requireRoles('admin', 'store_manager'),
  getUserById
);

// POST /api/users
router.post(
  '/',
  requireRoles('admin'),
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('role').isIn(['admin','store_manager','procurement_officer','site_engineer','finance','inspector','viewer']).withMessage('Invalid role'),
    body('department').optional().trim(),
    body('phone').optional().trim(),
  ],
  createUser
);

// PUT /api/users/:id
router.put(
  '/:id',
  requireRoles('admin'),
  [
    param('id').isUUID(),
    body('name').optional().trim().notEmpty(),
    body('role').optional().isIn(['admin','store_manager','procurement_officer','site_engineer','finance','inspector','viewer']),
    body('department').optional().trim(),
    body('phone').optional().trim(),
  ],
  updateUser
);

// DELETE /api/users/:id (soft delete)
router.delete(
  '/:id',
  [param('id').isUUID()],
  requireRoles('admin'),
  deactivateUser
);

// PATCH /api/users/:id/reactivate
router.patch(
  '/:id/reactivate',
  [param('id').isUUID()],
  requireRoles('admin'),
  reactivateUser
);

export default router;
