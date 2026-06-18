import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { UserRole } from '../types';

// Cache role permissions to avoid hitting DB on every request
const rolePermCache: Record<string, string[]> = {};

async function getRolePermissions(role: string): Promise<string[]> {
  if (rolePermCache[role]) return rolePermCache[role];

  const result = await query<{ permissions: string[] }>(
    'SELECT permissions FROM roles WHERE name = $1',
    [role]
  );
  const perms: string[] = result.rows[0]?.permissions ?? [];
  rolePermCache[role] = perms;
  return perms;
}

export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }
    if (!allowedRoles.includes(req.user.role as UserRole)) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }
    next();
  };
}

export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    const perms = await getRolePermissions(req.user.role);

    // Admin has wildcard
    if (perms.includes('*')) {
      next();
      return;
    }

    // Check exact or wildcard namespace match (e.g. "inventory:*" covers "inventory:read")
    const [ns, action] = permission.split(':');
    const allowed =
      perms.includes(permission) ||
      perms.includes(`${ns}:*`) ||
      perms.includes('*');

    if (!allowed) {
      res.status(403).json({ success: false, message: `Permission '${permission}' required` });
      return;
    }

    next();
  };
}

// Invalidate cache on role update
export function invalidateRoleCache(role?: string): void {
  if (role) delete rolePermCache[role];
  else Object.keys(rolePermCache).forEach((k) => delete rolePermCache[k]);
}
