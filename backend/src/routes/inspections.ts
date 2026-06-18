import { Router } from 'express';
import { createInspection, getInspection } from '../controllers/inspectionController';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();
router.use(authenticate);

router.post('/',            authorize('qaqc','admin'), createInspection);
router.get('/:grnId',       getInspection);

export default router;
