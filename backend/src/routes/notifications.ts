import { Router } from 'express';
import { getMyNotifications, markRead, markAllRead } from '../controllers/notificationController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/',           getMyNotifications);
router.put('/read-all',   markAllRead);
router.put('/:id/read',   markRead);

export default router;
