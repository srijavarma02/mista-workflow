import { Router } from 'express';
import { getVendors, createVendor, updateVendor, getVendorPerformance } from '../controllers/vendorController';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();
router.use(authenticate);

router.get('/performance',  getVendorPerformance);
router.get('/',             getVendors);
router.post('/',            authorize('procurement','admin'), createVendor);
router.put('/:id',          authorize('procurement','admin'), updateVendor);

export default router;
