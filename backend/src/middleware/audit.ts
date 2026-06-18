import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';

export function auditLog(action: string, entityType?: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Store original json method to intercept response body
    const originalJson = res.json.bind(res);

    res.json = (body: unknown) => {
      // Fire and forget audit insert after response
      if (req.user) {
        const entityId = req.params.id || (body as Record<string, unknown>)?.data?.id || null;
        query(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value, ip_address, user_agent)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            req.user.userId,
            action,
            entityType || null,
            entityId || null,
            JSON.stringify(req.body),
            req.ip,
            req.headers['user-agent'] || null,
          ]
        ).catch((err) => console.error('Audit log error:', err));
      }
      return originalJson(body);
    };

    next();
  };
}
