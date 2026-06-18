import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';

export async function getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [
      totalItems, lowStock, pendingMRFs, activePOs,
      monthlyProcurement, recentIssues, recentGRNs, pendingInspections,
    ] = await Promise.all([
      // Total active inventory items
      query('SELECT COUNT(*) AS cnt, SUM(available_qty * unit_cost) AS total_value FROM inventory WHERE is_active=true'),
      // Low stock count
      query('SELECT COUNT(*) AS cnt FROM inventory WHERE available_qty <= reorder_level AND is_active=true'),
      // Pending approvals
      query("SELECT COUNT(*) AS cnt FROM material_requests WHERE status IN ('submitted')"),
      // Active POs
      query("SELECT COUNT(*) AS cnt FROM purchase_orders WHERE status NOT IN ('delivered','cancelled')"),
      // Monthly procurement cost (current month)
      query(`
        SELECT COALESCE(SUM(total_amount),0) AS cost
        FROM purchase_orders
        WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
          AND status != 'cancelled'
      `),
      // Recent 5 material issues
      query(`
        SELECT mi.issue_number, mi.issue_date, mi.status,
               u.name AS issued_to, p.name AS project_name
        FROM material_issues mi
        JOIN users u ON u.id = mi.received_by
        LEFT JOIN projects p ON p.id = mi.project_id
        ORDER BY mi.created_at DESC LIMIT 5
      `),
      // Recent 5 GRNs
      query(`
        SELECT g.grn_number, g.received_date, g.status,
               v.name AS vendor_name, po.po_number
        FROM grns g
        JOIN purchase_orders po ON po.id = g.po_id
        JOIN vendors v ON v.id = po.vendor_id
        ORDER BY g.created_at DESC LIMIT 5
      `),
      // Pending QA/QC inspections
      query("SELECT COUNT(*) AS cnt FROM grns WHERE status = 'pending'"),
    ]);

    // Monthly consumption trend (last 6 months)
    const consumptionTrend = await query(`
      SELECT TO_CHAR(DATE_TRUNC('month', sl.created_at), 'Mon YYYY') AS month,
             SUM(ABS(sl.quantity * i.unit_cost)) AS value
      FROM stock_ledger sl
      JOIN inventory i ON i.id = sl.inventory_id
      WHERE sl.transaction_type = 'issue'
        AND sl.created_at >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', sl.created_at)
      ORDER BY DATE_TRUNC('month', sl.created_at)
    `);

    // Top 5 consumed materials this month
    const topConsumed = await query(`
      SELECT i.material_name, i.unit, SUM(ABS(sl.quantity)) AS qty_consumed
      FROM stock_ledger sl
      JOIN inventory i ON i.id = sl.inventory_id
      WHERE sl.transaction_type = 'issue'
        AND DATE_TRUNC('month', sl.created_at) = DATE_TRUNC('month', NOW())
      GROUP BY i.id, i.material_name, i.unit
      ORDER BY qty_consumed DESC LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        summary: {
          totalItems: parseInt((totalItems.rows[0] as { cnt: string }).cnt),
          totalInventoryValue: parseFloat((totalItems.rows[0] as { total_value: string }).total_value || '0'),
          lowStockItems: parseInt((lowStock.rows[0] as { cnt: string }).cnt),
          pendingMRFs: parseInt((pendingMRFs.rows[0] as { cnt: string }).cnt),
          activePOs: parseInt((activePOs.rows[0] as { cnt: string }).cnt),
          monthlyProcurementCost: parseFloat((monthlyProcurement.rows[0] as { cost: string }).cost),
          pendingInspections: parseInt((pendingInspections.rows[0] as { cnt: string }).cnt),
        },
        recentIssues: recentIssues.rows,
        recentGRNs: recentGRNs.rows,
        consumptionTrend: consumptionTrend.rows,
        topConsumedMaterials: topConsumed.rows,
      },
    });
  } catch (err) { next(err); }
}
