import { Router } from 'express';
import { createGRN, getGRNs, getGRN, finaliseGRN } from '../controllers/grnController';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();
router.use(authenticate);

router.post('/',               authorize('stores_executive','admin'), createGRN);
router.get('/',                getGRNs);
router.get('/:id',             getGRN);
router.put('/:id/finalise',    authorize('stores_executive','admin'), finaliseGRN);

export default router;
