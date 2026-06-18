import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { Response } from 'express';
import { query } from '../config/database';

// ── PDF Helper ──────────────────────────────────────────────
function pdfHeader(doc: PDFKit.PDFDocument, title: string): void {
  doc.rect(0, 0, doc.page.width, 60).fill('#1e40af');
  doc.fillColor('white').fontSize(18).text(title, 40, 20);
  doc.fillColor('black').fontSize(10).moveDown(3);
}

// ── Inventory Report ────────────────────────────────────────
export async function generateInventoryReportPDF(res: Response): Promise<void> {
  const rows = await query(`
    SELECT item_code, material_name, category, unit,
           available_qty, reserved_qty, reorder_level,
           unit_cost, (available_qty * unit_cost) AS total_value,
           warehouse_location
    FROM inventory WHERE is_active = true ORDER BY category, material_name
  `);

  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="inventory_report.pdf"');
  doc.pipe(res);

  pdfHeader(doc, 'Inventory Report');

  const headers = ['Item Code', 'Material', 'Category', 'Unit', 'Available', 'Reserved', 'Unit Cost', 'Total Value'];
  const colW = [70, 120, 80, 40, 60, 60, 65, 80];
  let x = 40, y = doc.y;

  // Table header
  doc.fontSize(9).fillColor('#1e40af');
  headers.forEach((h, i) => { doc.text(h, x, y, { width: colW[i], align: 'left' }); x += colW[i]; });
  doc.moveTo(40, y + 14).lineTo(780, y + 14).stroke('#1e40af');
  y += 18;

  doc.fillColor('black').fontSize(8);
  rows.rows.forEach((row: Record<string, unknown>, idx: number) => {
    if (y > 520) { doc.addPage({ layout: 'landscape' }); y = 40; }
    if (idx % 2 === 0) doc.rect(40, y - 2, 740, 14).fill('#f0f4ff').fillColor('black');
    x = 40;
    const cells = [
      row.item_code, row.material_name, row.category, row.unit,
      row.available_qty, row.reserved_qty,
      `₹${parseFloat(row.unit_cost as string).toFixed(2)}`,
      `₹${parseFloat(row.total_value as string || '0').toFixed(2)}`,
    ];
    cells.forEach((c, i) => { doc.text(String(c ?? ''), x, y, { width: colW[i] }); x += colW[i]; });
    y += 14;
  });

  doc.end();
}

export async function generateInventoryReportExcel(res: Response): Promise<void> {
  const rows = await query(`
    SELECT item_code, material_name, category, unit,
           available_qty, reserved_qty, reorder_level,
           unit_cost, (available_qty * unit_cost) AS total_value
    FROM inventory WHERE is_active = true ORDER BY category, material_name
  `);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Inventory');

  ws.columns = [
    { header: 'Item Code',   key: 'item_code',    width: 15 },
    { header: 'Material',    key: 'material_name', width: 30 },
    { header: 'Category',    key: 'category',      width: 20 },
    { header: 'Unit',        key: 'unit',          width: 10 },
    { header: 'Available',   key: 'available_qty', width: 12 },
    { header: 'Reserved',    key: 'reserved_qty',  width: 12 },
    { header: 'Reorder Lvl', key: 'reorder_level', width: 12 },
    { header: 'Unit Cost',   key: 'unit_cost',     width: 12 },
    { header: 'Total Value', key: 'total_value',   width: 14 },
  ];

  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E40AF' } };
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };

  rows.rows.forEach((r: Record<string, unknown>) => ws.addRow(r));

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="inventory_report.xlsx"');
  await wb.xlsx.write(res);
}

// ── Consumption Report ──────────────────────────────────────
export async function generateConsumptionReportExcel(
  res: Response,
  startDate: string,
  endDate: string
): Promise<void> {
  const rows = await query(`
    SELECT i.item_code, i.material_name, i.category, i.unit,
           SUM(ABS(sl.quantity)) AS total_issued,
           COUNT(DISTINCT mi.project_id) AS projects_count
    FROM stock_ledger sl
    JOIN inventory i ON i.id = sl.inventory_id
    LEFT JOIN material_issues mi ON mi.id::TEXT = sl.reference_id::TEXT
    WHERE sl.transaction_type = 'issue'
      AND sl.created_at BETWEEN $1 AND $2
    GROUP BY i.id, i.item_code, i.material_name, i.category, i.unit
    ORDER BY total_issued DESC
  `, [startDate, endDate]);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Consumption');

  ws.columns = [
    { header: 'Item Code', key: 'item_code', width: 15 },
    { header: 'Material',  key: 'material_name', width: 30 },
    { header: 'Category',  key: 'category', width: 20 },
    { header: 'Unit',      key: 'unit', width: 10 },
    { header: 'Total Issued', key: 'total_issued', width: 15 },
    { header: 'Projects', key: 'projects_count', width: 12 },
  ];

  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E40AF' } };
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
  rows.rows.forEach((r: Record<string, unknown>) => ws.addRow(r));

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="consumption_report.xlsx"');
  await wb.xlsx.write(res);
}
