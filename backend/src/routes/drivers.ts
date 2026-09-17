import { Router } from 'express';
import {
  driverController,
  driverCreateSchema,
  driverUpdateSchema,
  driverIdParamSchema,
} from '../controllers/driverController';
import { validate } from '../middleware/validate';
import { authenticateToken, requirePermission } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/', requirePermission('catalog.view'), driverController.getAll);
router.get('/available-users', requirePermission('catalog.manage'), driverController.getAvailableUsers);
router.get('/available-vehicles', requirePermission('catalog.manage'), driverController.getAvailableVehicles);
router.get('/by-vehicle/:vehicleId', driverController.getDriversByVehicle);
router.post('/', requirePermission('catalog.manage'), ...validate(driverCreateSchema), driverController.create);
router.put('/:id', requirePermission('catalog.manage'), ...validate(driverUpdateSchema), driverController.update);
router.patch('/:id/toggle', requirePermission('catalog.manage'), ...validate(driverIdParamSchema), driverController.toggleStatus);
router.delete('/:id', requirePermission('catalog.manage'), ...validate(driverIdParamSchema), driverController.remove);

export default router;
