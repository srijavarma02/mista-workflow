import { Router } from 'express';
import { body, param } from 'express-validator';
import { listInspections, getInspectionById, createInspection } from './inspection.controller';
import { requireRoles } from '../../middleware/rbac';

const router = Router();

router.get('/', listInspections);
router.get('/:id', [param('id').isUUID()], getInspectionById);

router.post(
  '/',
  requireRoles('admin', 'inspector', 'store_manager'),
  [
    body('grn_id').isUUID().withMessage('Valid GRN ID is required'),
    body('test_certificates_ok').isBoolean(),
    body('po_compliance_ok').isBoolean(),
    body('physical_condition').optional().trim(),
    body('result').isIn(['pass', 'fail', 'partial']).withMessage('Result must be pass, fail, or partial'),
    body('remarks').optional().trim(),
  ],
  createInspection
);

export default router;
