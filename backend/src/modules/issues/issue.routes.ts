import { Router } from 'express';
import { body, param } from 'express-validator';
import { listIssues, getIssueById, createIssue, completeIssue } from './issue.controller';
import { requireRoles } from '../../middleware/rbac';

const router = Router();

router.get('/', listIssues);
router.get('/:id', [param('id').isUUID()], getIssueById);

router.post(
  '/',
  requireRoles('admin', 'store_manager'),
  [
    body('material_request_id').isUUID().withMessage('Valid material request ID is required'),
    body('received_by').isUUID().withMessage('Valid receiver user ID is required'),
    body('issue_date').isISO8601(),
    body('items').isArray({ min: 1 }),
    body('items.*.inventory_id').isUUID(),
    body('items.*.quantity_requested').isFloat({ min: 0.001 }),
    body('items.*.quantity_issued').isFloat({ min: 0 }),
  ],
  createIssue
);

router.patch(
  '/:id/complete',
  requireRoles('admin', 'store_manager'),
  [param('id').isUUID()],
  completeIssue
);

export default router;
