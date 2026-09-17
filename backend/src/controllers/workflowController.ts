import { Response } from 'express';
import { body, param, ValidationChain } from 'express-validator';
import { workflowService } from '../services/workflowService';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../middleware/auth';

export const featureParamSchema: ValidationChain[] = [
  param('featureCode')
    .notEmpty()
    .withMessage('featureCode là bắt buộc')
    .isString(),
];

export const toggleWorkflowSchema: ValidationChain[] = [
  param('featureCode').notEmpty().withMessage('featureCode là bắt buộc'),
  body('is_active').isBoolean().withMessage('is_active phải là boolean'),
];

export const saveWorkflowSchema: ValidationChain[] = [
  param('featureCode').notEmpty().withMessage('featureCode là bắt buộc'),
  body('name').optional().isString(),
  body('description').optional().isString(),
  body('steps').isArray({ min: 1 }).withMessage('steps phải là mảng có ít nhất 1 bước'),
  body('steps.*.step_code').notEmpty().withMessage('step_code là bắt buộc'),
  body('steps.*.step_name').notEmpty().withMessage('step_name là bắt buộc'),
  body('steps.*.status_code').notEmpty().withMessage('status_code là bắt buộc'),
  body('steps.*.allowed_actions').isArray().withMessage('allowed_actions phải là array'),
  body('steps.*.actor_type')
    .isIn(['role', 'user', 'dynamic', 'any'])
    .withMessage('actor_type không hợp lệ (role, user, dynamic, any)'),
  body('steps.*.assigned_role_ids').optional().isArray(),
  body('steps.*.assigned_user_ids').optional().isArray(),
  body('steps.*.dynamic_actor').optional().isIn(['assigned_driver', 'creator', 'dispatcher', null]),
  body('steps.*.is_initial').optional().isBoolean(),
  body('steps.*.is_final').optional().isBoolean(),
  body('transitions').optional().isArray(),
];

export const workflowController = {
  async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      const workflows = await workflowService.listWorkflows();
      sendSuccess(res, workflows, 'Danh sách quy trình');
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể tải danh sách quy trình', 500, error);
    }
  },

  async getByFeature(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { featureCode } = req.params;
      const workflow = await workflowService.getWorkflowByFeature(featureCode);
      sendSuccess(res, workflow, 'Chi tiết cấu hình quy trình');
    } catch (err) {
      if (err instanceof Error && err.name === 'WorkflowError') {
        const statusCode = (err as any).statusCode || 400;
        sendError(res, err.message, statusCode);
        return;
      }
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể tải chi tiết quy trình', 500, error);
    }
  },

  async toggleActive(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { featureCode } = req.params;
      const { is_active } = req.body;
      const updated = await workflowService.toggleWorkflowActive(featureCode, is_active);
      sendSuccess(res, updated, `Đã ${is_active ? 'bật' : 'tắt'} áp dụng quy trình thành công`);
    } catch (err) {
      if (err instanceof Error && err.name === 'WorkflowError') {
        const statusCode = (err as any).statusCode || 400;
        sendError(res, err.message, statusCode);
        return;
      }
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể cập nhật trạng thái quy trình', 500, error);
    }
  },

  async saveConfig(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { featureCode } = req.params;
      const saved = await workflowService.saveWorkflowConfig(featureCode, req.body);
      sendSuccess(res, saved, 'Đã lưu cấu hình quy trình thành công');
    } catch (err) {
      if (err instanceof Error && err.name === 'WorkflowError') {
        const statusCode = (err as any).statusCode || 400;
        sendError(res, err.message, statusCode);
        return;
      }
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể lưu cấu hình quy trình', 500, error);
    }
  },
};
