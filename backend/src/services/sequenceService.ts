/**
 * Generates sequential, human-readable document numbers.
 * e.g.  MRF-2024-0001,  PO-2024-0001,  GRN-2024-0001
 */
import { query } from '../config/database';

const prefixMap: Record<string, string> = {
  material_request:  'MRF',
  purchase_request:  'PR',
  purchase_order:    'PO',
  grn:               'GRN',
  material_issue:    'MIN',
  material_return:   'MRN',
};

export async function nextNumber(entityType: string): Promise<string> {
  const prefix = prefixMap[entityType] ?? entityType.toUpperCase();
  const year = new Date().getFullYear();

  // Table & column to count
  const tableMap: Record<string, { table: string; col: string }> = {
    material_request:  { table: 'material_requests',  col: 'request_number' },
    purchase_request:  { table: 'purchase_requests',  col: 'pr_number' },
    purchase_order:    { table: 'purchase_orders',     col: 'po_number' },
    grn:               { table: 'grns',                col: 'grn_number' },
    material_issue:    { table: 'material_issues',     col: 'issue_number' },
    material_return:   { table: 'material_returns',    col: 'return_number' },
  };

  const map = tableMap[entityType];
  if (!map) throw new Error(`Unknown entity type: ${entityType}`);

  const res = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM ${map.table} WHERE ${map.col} LIKE $1`,
    [`${prefix}-${year}-%`]
  );

  const count = parseInt(res.rows[0].count, 10) + 1;
  return `${prefix}-${year}-${String(count).padStart(4, '0')}`;
}
