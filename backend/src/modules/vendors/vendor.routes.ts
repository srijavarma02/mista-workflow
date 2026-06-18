import { Router } from 'express';
import { body, param } from 'express-validator';
import {
  listVendors,
  getVendorById,
  createVendor,
  updateVendor,
  deactivateVendor,
} from './vendor.controller';
import { requireRoles } from '../../middleware/rbac';

const router = Router();

router.get('/', listVendors);

router.get('/:id', [param('id').isUUID()], getVendorById);

router.post(
  '/',
  requireRoles('admin', 'procurement_officer'),
  [
    body('name').trim().notEmpty().withMessage('Vendor name is required'),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().trim(),
    body('contact_person').optional().trim(),
    body('address').optional().trim(),
    body('performance_score').optional().isFloat({ min: 0, max: 10 }),
  ],
  createVendor
);

router.put(
  '/:id',
  requireRoles('admin', 'procurement_officer'),
  [param('id').isUUID()],
  updateVendor
);

router.delete(
  '/:id',
  requireRoles('admin', 'procurement_officer'),
  [param('id').isUUID()],
  deactivateVendor
);

export default router;
