import { Router } from 'express';
import { body, param } from 'express-validator';
import {
  listGRNs,
  getGRNById,
  createGRN,
  updateGRNStatus,
  addGRNItem,
} from './grn.controller';
import { requireRoles } from '../../middleware/rbac';

const router = Router();

router.get('/', listGRNs);
router.get('/:id', [param('id').isUUID()], getGRNById);

router.post(
  '/',
  requireRoles('admin', 'store_manager'),
  [
    body('po_id').isUUID().withMessage('Valid PO ID is required'),
    body('received_date').isISO8601().withMessage('Valid received date required'),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.po_item_id').isUUID(),
    body('items.*.quantity_received').isFloat({ min: 0 }),
    body('items.*.quantity_accepted').isFloat({ min: 0 }),
    body('items.*.quantity_rejected').isFloat({ min: 0 }),
  ],
  createGRN
);

router.patch(
  '/:id/status',
  requireRoles('admin', 'store_manager'),
  [param('id').isUUID(), body('status').isIn(['draft','pending_inspection','inspected','accepted','rejected'])],
  updateGRNStatus
);

export default router;
