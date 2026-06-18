import { Router } from 'express';
import { createPO, getPOs, getPO, updatePOStatus } from '../controllers/purchaseOrderController';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();
router.use(authenticate);

router.post('/',          authorize('procurement','admin'), createPO);
router.get('/',           getPOs);
router.get('/:id',        getPO);
router.put('/:id/status', authorize('procurement','admin'), updatePOStatus);

export default router;
