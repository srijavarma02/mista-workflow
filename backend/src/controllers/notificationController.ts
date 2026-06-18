import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { markAsRead } from '../services/notificationService';

export async function getMyNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { unread_only } = req.query;
    const params: unknown[] = [req.user!.userId];
    const conds = ['user_id = $1'];
    if (unread_only === 'true') conds.push('is_read = false');

    const result = await query(
      `SELECT * FROM notifications WHERE ${conds.join(' AND ')} ORDER BY created_at DESC LIMIT 50`,
      params
    );
    const unreadCount = await query(
      'SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = $1 AND is_read = false',
      [req.user!.userId]
    );

    res.json({
      success: true,
      data: result.rows,
      unreadCount: parseInt((unreadCount.rows[0] as { cnt: string }).cnt),
    });
  } catch (err) { next(err); }
}

export async function markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await markAsRead(req.params.id, req.user!.userId);
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function markAllRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1',
      [req.user!.userId]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
}
