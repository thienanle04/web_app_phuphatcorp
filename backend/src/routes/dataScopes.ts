import { Router } from 'express';
import { dataScopeController } from '../controllers/dataScopeController';
import { authenticateToken, requirePermission } from '../middleware/auth';

const router = Router();

// Current user data scopes summary (any authenticated user)
router.get('/me', authenticateToken, dataScopeController.getMyDataScopes);

// Admin Data Scopes Management endpoints
router.get(
  '/features',
  authenticateToken,
  requirePermission('data_scopes.view'),
  dataScopeController.getFeatures,
);

router.put(
  '/features/:featureCode/roles/:roleId',
  authenticateToken,
  requirePermission('data_scopes.manage'),
  dataScopeController.updateRoleScope,
);

router.get(
  '/user-entities',
  authenticateToken,
  requirePermission('data_scopes.view'),
  dataScopeController.getUserEntityScopes,
);

router.post(
  '/user-entities',
  authenticateToken,
  requirePermission('data_scopes.manage'),
  dataScopeController.assignUserEntities,
);

router.delete(
  '/user-entities/:id',
  authenticateToken,
  requirePermission('data_scopes.manage'),
  dataScopeController.removeUserEntityScope,
);

export default router;
