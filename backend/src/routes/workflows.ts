import { Router } from 'express';
import {
  workflowController,
  featureParamSchema,
  toggleWorkflowSchema,
  saveWorkflowSchema,
} from '../controllers/workflowController';
import { validate } from '../middleware/validate';
import { authenticateToken, requirePermission } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/', requirePermission('workflows.view'), workflowController.list);
router.get('/:featureCode', requirePermission('workflows.view'), ...validate(featureParamSchema), workflowController.getByFeature);
router.patch('/:featureCode/toggle', requirePermission('workflows.manage'), ...validate(toggleWorkflowSchema), workflowController.toggleActive);
router.put('/:featureCode', requirePermission('workflows.manage'), ...validate(saveWorkflowSchema), workflowController.saveConfig);

export default router;
