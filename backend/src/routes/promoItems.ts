import { Router } from 'express';
import {
  promoItemController,
  promoItemCreateSchema,
  promoItemUpdateSchema,
  promoItemDeleteSchema,
} from '../controllers/promoItemController';
import { validate } from '../middleware/validate';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/', promoItemController.getAll);
router.post('/', ...validate(promoItemCreateSchema), promoItemController.create);
router.put('/:id', ...validate(promoItemUpdateSchema), promoItemController.update);
router.delete('/:id', ...validate(promoItemDeleteSchema), promoItemController.remove);

export default router;
