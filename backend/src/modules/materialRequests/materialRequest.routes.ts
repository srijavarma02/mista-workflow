import { Router } from 'express';
import { body, param } from 'express-validator';
import {
  listMaterialRequests,
  getMaterialRequestById,
  createMaterialRequest,
  updateMaterialRequest,
  approveMaterialRequest,
  rejectMaterialRequest,
  cancelMaterialRequest,
} from './materialRequest.controller';
import { requireRoles } from '../../middleware/rbac';

const router = Router();

router.get('/', listMaterialRequests);

router.get('/:id', [param('id').isUUID()], getMaterialRequestById);

router.post(
  '/',
  requireRoles('admin', 'store_manager', 'site_engineer', 'procurement_officer'),
  [
    body('project_id').isUUID().withMessage('Valid project ID is required'),
    body('material_name').trim().notEmpty().withMessage('Material name is required'),
    body('quantity').isFloat({ min: 0.001 }).withMessage('Quantity must be positive'),
    body('unit').trim().notEmpty().withMessage('Unit is required'),
    body('required_date').isISO8601().withMessage('Valid required date is required'),
    body('priority').optional().isIn(['low','medium','high','critical']),
    body('remarks').optional().trim(),
  ],
  createMaterialRequest
);

router.put(
  '/:id',
  requireRoles('admin', 'store_manager', 'site_engineer', 'procurement_officer'),
  [param('id').isUUID()],
  updateMaterialRequest
);

router.post(
  '/:id/approve',
  requireRoles('admin', 'store_manager'),
  [param('id').isUUID(), body('remarks').optional().trim()],
  approveMaterialRequest
);

router.post(
  '/:id/reject',
  requireRoles('admin', 'store_manager'),
  [param('id').isUUID(), body('remarks').trim().notEmpty().withMessage('Rejection remarks are required')],
  rejectMaterialRequest
);

router.post(
  '/:id/cancel',
  requireRoles('admin', 'store_manager', 'site_engineer'),
  [param('id').isUUID()],
  cancelMaterialRequest
);

export default router;
