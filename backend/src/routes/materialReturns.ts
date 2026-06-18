import { Router } from 'express';
import { createReturn, acceptReturn, getReturns } from '../controllers/materialReturnController';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();
router.use(authenticate);

router.post('/',           createReturn);
router.get('/',            getReturns);
router.put('/:id/accept',  authorize('stores_executive','admin'), acceptReturn);

export default router;
