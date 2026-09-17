import { Router } from 'express';
import {
  deliveryPointController,
  deliveryPointCreateSchema,
  deliveryPointUpdateSchema,
  deliveryPointDeleteSchema,
} from '../controllers/deliveryPointController';
import { validate } from '../middleware/validate';
import { authenticateToken, requirePermission } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/', requirePermission('catalog.view'), deliveryPointController.getAll);
router.post('/', requirePermission('catalog.manage'), ...validate(deliveryPointCreateSchema), deliveryPointController.create);
router.put('/:id', requirePermission('catalog.manage'), ...validate(deliveryPointUpdateSchema), deliveryPointController.update);
router.delete('/:id', requirePermission('catalog.manage'), ...validate(deliveryPointDeleteSchema), deliveryPointController.remove);

export default router;
