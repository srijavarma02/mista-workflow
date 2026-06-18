import OpenAI from 'openai';
import { query } from '../config/database';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function getInventoryContext(): Promise<string> {
  const [inv, lowStock, pending] = await Promise.all([
    query(`SELECT material_name, available_qty, unit, reorder_level
           FROM inventory WHERE is_active = true ORDER BY material_name LIMIT 50`),
    query(`SELECT material_name, available_qty, reorder_level, unit
           FROM inventory WHERE available_qty <= reorder_level AND is_active = true`),
    query(`SELECT COUNT(*) AS cnt FROM material_requests WHERE status IN ('submitted','approved')`),
  ]);

  return `
CURRENT INVENTORY SNAPSHOT (top 50):
${inv.rows.map((r: Record<string, unknown>) => `- ${r.material_name}: ${r.available_qty} ${r.unit} (reorder: ${r.reorder_level})`).join('\n')}

LOW STOCK ITEMS (${lowStock.rows.length}):
${lowStock.rows.map((r: Record<string, unknown>) => `- ${r.material_name}: ${r.available_qty}/${r.reorder_level} ${r.unit}`).join('\n') || 'None'}

PENDING MATERIAL REQUESTS: ${(pending.rows[0] as Record<string, unknown>).cnt}
`;
}

export async function chatWithAI(userMessage: string): Promise<string> {
  const context = await getInventoryContext();

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are an intelligent assistant for a construction company's Stores and Inventory Management System.
You help stores executives, project managers, and procurement teams with material tracking, stock analysis, and procurement decisions.
You have access to real-time inventory data. Be concise, professional, and data-driven.

${context}`,
      },
      { role: 'user', content: userMessage },
    ],
    max_tokens: 800,
    temperature: 0.3,
  });

  return completion.choices[0].message.content || 'No response generated.';
}

export async function getPredictions(): Promise<Record<string, unknown>> {
  // Consumption trend for last 30 days
  const consumption = await query(`
    SELECT i.material_name, i.unit,
           SUM(ABS(sl.quantity)) AS total_consumed,
           COUNT(*) AS transactions
    FROM stock_ledger sl
    JOIN inventory i ON i.id = sl.inventory_id
    WHERE sl.transaction_type = 'issue'
      AND sl.created_at >= NOW() - INTERVAL '30 days'
    GROUP BY i.id, i.material_name, i.unit
    ORDER BY total_consumed DESC
    LIMIT 20
  `);

  // Projected need
  const predictions = consumption.rows.map((row: Record<string, unknown>) => {
    const dailyAvg = parseFloat(row.total_consumed as string) / 30;
    return {
      material_name: row.material_name,
      unit: row.unit,
      daily_avg_consumption: dailyAvg.toFixed(2),
      projected_30_day_need: (dailyAvg * 30).toFixed(2),
    };
  });

  return { predictions, generatedAt: new Date().toISOString() };
}

export async function getAnomalies(): Promise<Record<string, unknown>[]> {
  const result = await query(`
    SELECT i.material_name, i.unit,
           AVG(ABS(sl.quantity)) AS avg_qty,
           STDDEV(ABS(sl.quantity)) AS stddev_qty,
           MAX(ABS(sl.quantity)) AS max_qty
    FROM stock_ledger sl
    JOIN inventory i ON i.id = sl.inventory_id
    WHERE sl.transaction_type = 'issue'
      AND sl.created_at >= NOW() - INTERVAL '90 days'
    GROUP BY i.id, i.material_name, i.unit
    HAVING STDDEV(ABS(sl.quantity)) > AVG(ABS(sl.quantity)) * 0.5
  `);
  return result.rows;
}
