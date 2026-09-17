import { Router } from 'express';
import {
  promoItemController,
  promoItemCreateSchema,
  promoItemUpdateSchema,
  promoItemDeleteSchema,
} from '../controllers/promoItemController';
import { validate } from '../middleware/validate';
import { authenticateToken, requirePermission } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/', requirePermission('catalog.view'), promoItemController.getAll);
router.post('/', requirePermission('catalog.manage'), ...validate(promoItemCreateSchema), promoItemController.create);
router.put('/:id', requirePermission('catalog.manage'), ...validate(promoItemUpdateSchema), promoItemController.update);
router.delete('/:id', requirePermission('catalog.manage'), ...validate(promoItemDeleteSchema), promoItemController.remove);

export default router;
