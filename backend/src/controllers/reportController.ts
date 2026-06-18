import { Request, Response, NextFunction } from 'express';
import {
  generateInventoryReportPDF,
  generateInventoryReportExcel,
  generateConsumptionReportExcel,
} from '../services/reportService';
import { query } from '../config/database';

export async function inventoryReportPDF(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { await generateInventoryReportPDF(res); }
  catch (err) { next(err); }
}

export async function inventoryReportExcel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { await generateInventoryReportExcel(res); }
  catch (err) { next(err); }
}

export async function consumptionReportExcel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const startDate = (req.query.start as string) || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const endDate = (req.query.end as string) || new Date().toISOString();
    await generateConsumptionReportExcel(res, startDate, endDate);
  } catch (err) { next(err); }
}

export async function procurementReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await query(`
      SELECT po.po_number, v.name AS vendor, po.status,
             po.total_amount, po.delivery_date, po.created_at,
             COUNT(pi.id) AS line_items
      FROM purchase_orders po
      JOIN vendors v ON v.id = po.vendor_id
      LEFT JOIN po_items pi ON pi.po_id = po.id
      GROUP BY po.id, v.name
      ORDER BY po.created_at DESC
      LIMIT 200
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
}

export async function utilizationReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await query(`
      SELECT i.item_code, i.material_name, i.category, i.unit,
             COALESCE(SUM(CASE WHEN sl.transaction_type='inward' THEN sl.quantity END), 0) AS total_received,
             COALESCE(SUM(CASE WHEN sl.transaction_type='issue' THEN ABS(sl.quantity) END), 0) AS total_issued,
             COALESCE(SUM(CASE WHEN sl.transaction_type='return' THEN sl.quantity END), 0) AS total_returned,
             i.available_qty AS current_stock
      FROM inventory i
      LEFT JOIN stock_ledger sl ON sl.inventory_id = i.id
      WHERE i.is_active = true
      GROUP BY i.id, i.item_code, i.material_name, i.category, i.unit, i.available_qty
      ORDER BY total_issued DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
}
