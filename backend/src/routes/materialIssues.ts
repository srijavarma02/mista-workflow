import { Router } from 'express';
import {
  createMaterialIssue, approveMaterialIssue, getMaterialIssues,
} from '../controllers/materialIssueController';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();
router.use(authenticate);

router.post('/',           authorize('stores_executive','admin'), createMaterialIssue);
router.get('/',            getMaterialIssues);
router.put('/:id/approve', authorize('project_manager','admin'), approveMaterialIssue);

export default router;
