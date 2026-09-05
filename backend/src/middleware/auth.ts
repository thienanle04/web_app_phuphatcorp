import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { UserRole } from '../types/user';
import { pool } from '../config/database';

export interface AuthRequest extends Request {
  user?: {
    userId: number;
    email: string;
    role: UserRole;
    roleId: number | null;
    permissions: string[];
  };
}

export function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ success: false, message: 'Access token required' });
    return;
  }

  try {
    const payload = verifyToken(token);
    req.user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role as UserRole,
      roleId: payload.roleId ?? null,
      permissions: payload.permissions ?? [],
    };

    // Check role is still active — enforces deactivation within each 15-min token lifecycle
    if (payload.roleId) {
      pool
        .query<{ is_active: boolean }>(
          'SELECT r.is_active FROM roles r WHERE r.id = $1',
          [payload.roleId],
        )
        .then((result) => {
          if (!result.rows[0] || !result.rows[0].is_active) {
            res.status(403).json({
              success: false,
              message: 'Vai trò của bạn đã bị thu hồi. Vui lòng liên hệ admin.',
            });
            return;
          }
          next();
        })
        .catch(() => {
          // If DB check fails, allow through to avoid breaking the app
          next();
        });
    } else {
      next();
    }
  } catch {
    // 401 = token hết hạn hoặc không hợp lệ → frontend interceptor sẽ tự refresh
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

export function authorizeRoles(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

export function requirePermission(permissionCode: string) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    if (!req.user.permissions.includes(permissionCode)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

export function requireAnyPermission(...permissionCodes: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    if (!permissionCodes.some((code) => req.user!.permissions.includes(code))) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
