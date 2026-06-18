import { Router } from 'express';
import { body, param } from 'express-validator';
import {
  listPurchaseRequests,
  getPurchaseRequestById,
  createPurchaseRequest,
  approvePurchaseRequest,
  rejectPurchaseRequest,
} from './purchaseRequest.controller';
import { requireRoles } from '../../middleware/rbac';

const router = Router();

router.get('/', requireRoles('admin', 'store_manager', 'procurement_officer'), listPurchaseRequests);

router.get('/:id', [param('id').isUUID()], requireRoles('admin', 'store_manager', 'procurement_officer'), getPurchaseRequestById);

router.post(
  '/',
  requireRoles('admin', 'store_manager', 'procurement_officer'),
  [
    body('material_request_id').isUUID().withMessage('Valid material request ID is required'),
    body('inventory_id').optional().isUUID(),
    body('quantity').isFloat({ min: 0.001 }).withMessage('Quantity must be positive'),
  ],
  createPurchaseRequest
);

router.post(
  '/:id/approve',
  requireRoles('admin', 'procurement_officer'),
  [param('id').isUUID()],
  approvePurchaseRequest
);

router.post(
  '/:id/reject',
  requireRoles('admin', 'procurement_officer'),
  [param('id').isUUID(), body('remarks').trim().notEmpty()],
  rejectPurchaseRequest
);

export default router;
