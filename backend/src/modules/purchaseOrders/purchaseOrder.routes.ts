import { Router } from 'express';
import { body, param } from 'express-validator';
import {
  listPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  addPOItem,
} from './purchaseOrder.controller';
import { requireRoles } from '../../middleware/rbac';

const router = Router();

router.get('/', listPurchaseOrders);
router.get('/:id', [param('id').isUUID()], getPurchaseOrderById);

router.post(
  '/',
  requireRoles('admin', 'procurement_officer'),
  [
    body('vendor_id').isUUID().withMessage('Valid vendor ID is required'),
    body('delivery_date').optional().isISO8601(),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.quantity').isFloat({ min: 0.001 }),
    body('items.*.unit_price').isFloat({ min: 0 }),
  ],
  createPurchaseOrder
);

router.patch(
  '/:id/status',
  requireRoles('admin', 'procurement_officer'),
  [
    param('id').isUUID(),
    body('status').isIn(['draft','sent','acknowledged','partially_received','received','cancelled']),
  ],
  updatePurchaseOrderStatus
);

router.post(
  '/:id/items',
  requireRoles('admin', 'procurement_officer'),
  [
    param('id').isUUID(),
    body('inventory_id').optional().isUUID(),
    body('quantity').isFloat({ min: 0.001 }),
    body('unit_price').isFloat({ min: 0 }),
  ],
  addPOItem
);

export default router;
