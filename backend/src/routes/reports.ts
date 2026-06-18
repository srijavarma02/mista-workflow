import { Router } from 'express';
import {
  inventoryReportPDF, inventoryReportExcel, consumptionReportExcel,
  procurementReport, utilizationReport,
} from '../controllers/reportController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/inventory/pdf',     inventoryReportPDF);
router.get('/inventory/excel',   inventoryReportExcel);
router.get('/consumption/excel', consumptionReportExcel);
router.get('/procurement',       procurementReport);
router.get('/utilization',       utilizationReport);

export default router;
