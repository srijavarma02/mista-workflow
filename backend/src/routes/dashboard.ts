import { Router } from 'express';
import { getDashboard } from '../controllers/dashboardController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);
router.get('/', getDashboard);

export default router;
