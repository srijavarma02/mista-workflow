import { Router } from 'express';
import {
  getInventory, getInventoryItem, createInventoryItem,
  updateInventoryItem, getLowStock, getItemLedger, getCategories,
} from '../controllers/inventoryController';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();
router.use(authenticate);

router.get('/categories',    getCategories);
router.get('/low-stock',     getLowStock);
router.get('/',              getInventory);
router.get('/:id',           getInventoryItem);
router.get('/:id/ledger',    getItemLedger);
router.post('/',             authorize('admin','stores_executive'), createInventoryItem);
router.put('/:id',           authorize('admin','stores_executive'), updateInventoryItem);

export default router;
