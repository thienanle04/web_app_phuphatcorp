import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { dataScopeService } from '../services/dataScopeService';

/**
 * Middleware to resolve data-level scope for a specific feature and inject into req.dataScope
 */
export function resolveDataScope(featureCode: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      next();
      return;
    }

    try {
      const scope = await dataScopeService.resolveScope(
        req.user.userId,
        req.user.roleId,
        req.user.role,
        featureCode,
      );
      req.dataScope = scope;
      next();
    } catch (err) {
      next(err);
    }
  };
}
