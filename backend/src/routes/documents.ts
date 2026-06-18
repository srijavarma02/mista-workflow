import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { query } from '../config/database';
import { uploadFile } from '../config/supabase';
import { createError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf','image/jpeg','image/png','application/vnd.ms-excel',
                     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('File type not allowed'));
  },
});

router.post('/upload', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw createError('No file uploaded');
    const { entity_type, entity_id } = req.body;
    if (!entity_type || !entity_id) throw createError('entity_type and entity_id are required');

    const fileName = `${Date.now()}-${req.file.originalname.replace(/\s+/g, '_')}`;
    const url = await uploadFile(req.file.buffer, fileName, req.file.mimetype, entity_type);

    const result = await query(
      `INSERT INTO documents (entity_type, entity_id, file_name, file_url, file_type, file_size, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [entity_type, entity_id, req.file.originalname, url, req.file.mimetype, req.file.size, req.user!.userId]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

router.get('/:entityType/:entityId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT d.*, u.name AS uploaded_by_name FROM documents d
       JOIN users u ON u.id = d.uploaded_by
       WHERE d.entity_type=$1 AND d.entity_id=$2
       ORDER BY d.created_at DESC`,
      [req.params.entityType, req.params.entityId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

export default router;
