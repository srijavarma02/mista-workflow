import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export async function listMaterialMasters(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const search = String(req.query.search || '').trim();
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
    const params: unknown[] = [];
    const conditions: string[] = ['mm.status = $1'];
    params.push('active');

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(mm.material_name ILIKE $${params.length} OR mm.material_code ILIKE $${params.length})`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const { rows } = await query(
      `SELECT mm.*, 
              COALESCE(inv.available_qty, 0) AS available_qty,
              COALESCE(inv.reserved_qty, 0) AS reserved_qty,
              COALESCE(inv.available_qty, 0) + COALESCE(inv.reserved_qty, 0) AS physical_qty,
              inv.id AS inventory_id
       FROM material_master mm
       LEFT JOIN LATERAL (
         SELECT id, available_qty, reserved_qty
         FROM inventory
         WHERE material_master_id = mm.id
         ORDER BY available_qty DESC
         LIMIT 1
       ) inv ON true
       ${where}
       ORDER BY mm.material_name ASC
       LIMIT $${params.length + 1}`,
      [...params, limit]
    );

    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

export async function getMaterialMasterById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { rows } = await query(
      `SELECT mm.*, 
              COALESCE(inv.available_qty, 0) AS available_qty,
              COALESCE(inv.reserved_qty, 0) AS reserved_qty,
              COALESCE(inv.available_qty, 0) + COALESCE(inv.reserved_qty, 0) AS physical_qty,
              inv.id AS inventory_id
       FROM material_master mm
       LEFT JOIN LATERAL (
         SELECT id, available_qty, reserved_qty
         FROM inventory
         WHERE material_master_id = mm.id
         ORDER BY available_qty DESC
         LIMIT 1
       ) inv ON true
       WHERE mm.id = $1`,
      [req.params.id]
    );

    if (!rows[0]) throw new AppError('Material master item not found.', 404, 'NOT_FOUND');
    res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function createMaterialMaster(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { material_code, material_name, category, unit_of_measurement, reorder_level, description, status } = req.body;

    if (!material_code || !material_name || !category || !unit_of_measurement) {
      throw new AppError('material_code, material_name, category, and unit_of_measurement are required', 400, 'VALIDATION_ERROR');
    }

    const id = uuidv4();
    const result = await query(
      `INSERT INTO material_master
         (id, material_code, material_name, category, unit_of_measurement, reorder_level, description, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        id,
        material_code,
        material_name,
        category,
        unit_of_measurement,
        reorder_level ?? 0,
        description ?? null,
        status ?? 'active',
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}
