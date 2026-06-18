import { Router } from 'express';
import { chat, predictions, anomalies } from '../controllers/aiController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.post('/chat',        chat);
router.get('/predictions',  predictions);
router.get('/anomalies',    anomalies);

export default router;
