import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { createMaterialMaster, getMaterialMasterById, listMaterialMasters } from '../controllers/materialMasterController';

const router = Router();
router.use(authenticate);

router.get('/', listMaterialMasters);
router.get('/:id', getMaterialMasterById);
router.post('/', authorize('admin','procurement'), createMaterialMaster);

export default router;
