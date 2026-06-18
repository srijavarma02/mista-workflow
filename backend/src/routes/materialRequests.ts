import { Router } from 'express';
import { createMRF, getMRFs, getMRF, approveMRF, rejectMRF } from '../controllers/materialRequestController';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();
router.use(authenticate);

router.post('/',              authorize('site_engineer','admin'), createMRF);
router.get('/',               getMRFs);
router.get('/:id',            getMRF);
router.put('/:id/approve',    authorize('project_manager','admin'), approveMRF);
router.put('/:id/reject',     authorize('project_manager','admin'), rejectMRF);

export default router;
