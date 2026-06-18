import { Router } from 'express';
import { getUsers, createUser, updateUser } from '../controllers/userController';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();
router.use(authenticate);

router.get('/',    authorize('admin'), getUsers);
router.post('/',   authorize('admin'), createUser);
router.put('/:id', authorize('admin'), updateUser);

export default router;
