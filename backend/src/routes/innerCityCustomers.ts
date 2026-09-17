import { Router } from 'express';
import {
  innerCityCustomerController,
  innerCityCustomerCreateSchema,
  innerCityCustomerUpdateSchema,
  innerCityCustomerDeleteSchema,
} from '../controllers/innerCityCustomerController';
import { validate } from '../middleware/validate';
import { authenticateToken, requirePermission } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/', requirePermission('catalog.view'), innerCityCustomerController.getAll);
router.post('/', requirePermission('catalog.manage'), ...validate(innerCityCustomerCreateSchema), innerCityCustomerController.create);
router.put('/:id', requirePermission('catalog.manage'), ...validate(innerCityCustomerUpdateSchema), innerCityCustomerController.update);
router.delete('/:id', requirePermission('catalog.manage'), ...validate(innerCityCustomerDeleteSchema), innerCityCustomerController.remove);

export default router;
