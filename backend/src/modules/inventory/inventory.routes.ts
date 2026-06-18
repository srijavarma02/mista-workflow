import { Router } from 'express';
import { body, param } from 'express-validator';
import {
  listInventory,
  getInventoryById,
  createInventoryItem,
  updateInventoryItem,
  adjustStock,
  getLedger,
  getLowStockItems,
} from './inventory.controller';
import { requireRoles } from '../../middleware/rbac';

const router = Router();

// GET /api/inventory
router.get('/', listInventory);

// GET /api/inventory/low-stock
router.get('/low-stock', getLowStockItems);

// GET /api/inventory/:id
router.get('/:id', [param('id').isUUID()], getInventoryById);

// GET /api/inventory/:id/ledger
router.get('/:id/ledger', [param('id').isUUID()], getLedger);

// POST /api/inventory
router.post(
  '/',
  requireRoles('admin', 'store_manager'),
  [
    body('item_code').trim().notEmpty().withMessage('Item code is required'),
    body('material_name').trim().notEmpty().withMessage('Material name is required'),
    body('category').trim().notEmpty().withMessage('Category is required'),
    body('unit').trim().notEmpty().withMessage('Unit is required'),
    body('available_qty').isFloat({ min: 0 }).withMessage('Available quantity must be >= 0'),
    body('reorder_level').isFloat({ min: 0 }).withMessage('Reorder level must be >= 0'),
    body('unit_cost').isFloat({ min: 0 }).withMessage('Unit cost must be >= 0'),
    body('warehouse_location').optional().trim(),
  ],
  createInventoryItem
);

// PUT /api/inventory/:id
router.put(
  '/:id',
  requireRoles('admin', 'store_manager'),
  [param('id').isUUID()],
  updateInventoryItem
);

// POST /api/inventory/:id/adjust
router.post(
  '/:id/adjust',
  requireRoles('admin', 'store_manager'),
  [
    param('id').isUUID(),
    body('quantity').isFloat().withMessage('Quantity is required'),
    body('reason').trim().notEmpty().withMessage('Reason for adjustment is required'),
  ],
  adjustStock
);

export default router;
