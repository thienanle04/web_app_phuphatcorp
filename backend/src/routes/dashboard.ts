import { Router } from 'express';
import { dashboardController } from '../controllers/dashboardController';
import { authenticateToken, requirePermission, requireAnyPermission } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/overview', requirePermission('dashboard.view'), dashboardController.overview);
router.get('/vehicle-maintenance', requirePermission('vehicle_data.view'), dashboardController.vehicleMaintenance);
router.get('/accounting', requirePermission('accounting_data.view'), dashboardController.accounting);
router.get('/operations', requireAnyPermission('transport.view', 'dispatch.view'), dashboardController.operations);
router.get('/fuel', requirePermission('fuel.view'), dashboardController.fuel);

export default router;
