import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { dataScopeService, DataScopeError } from '../services/dataScopeService';
import { sendSuccess, sendError } from '../utils/response';
import { ScopeType } from '../types/dataScope';

export const dataScopeController = {
  async getFeatures(req: AuthRequest, res: Response): Promise<void> {
    try {
      const features = await dataScopeService.getFeaturesWithConfigs();
      sendSuccess(res, features, 'Danh sách cấu hình phạm vi dữ liệu theo tính năng');
    } catch (err: any) {
      sendError(res, 'Lỗi lấy danh sách cấu hình phạm vi dữ liệu', 500, err.message);
    }
  },

  async updateRoleScope(req: AuthRequest, res: Response): Promise<void> {
    try {
      const featureCode = req.params.featureCode;
      const roleId = parseInt(req.params.roleId, 10);
      if (Number.isNaN(roleId) || roleId <= 0) {
        sendError(res, 'ID vai trò không hợp lệ', 400);
        return;
      }

      const { scope_type } = req.body as { scope_type: ScopeType };

      if (!scope_type) {
        sendError(res, 'Thiếu thông tin scope_type', 400);
        return;
      }

      const updated = await dataScopeService.updateRoleScopeConfig(featureCode, roleId, scope_type);
      sendSuccess(res, updated, 'Cập nhật cấu hình phạm vi vai trò thành công');
    } catch (err: any) {
      if (err instanceof DataScopeError) {
        sendError(res, err.message, err.statusCode, err.code);
        return;
      }
      sendError(res, 'Lỗi cập nhật cấu hình phạm vi vai trò', 500, err.message);
    }
  },

  async getUserEntityScopes(req: AuthRequest, res: Response): Promise<void> {
    try {
      const featureCode = req.query.feature_code as string | undefined;
      let userId: number | undefined;
      if (req.query.user_id) {
        const parsedUserId = parseInt(req.query.user_id as string, 10);
        if (Number.isNaN(parsedUserId) || parsedUserId <= 0) {
          sendError(res, 'user_id không hợp lệ', 400);
          return;
        }
        userId = parsedUserId;
      }

      const userEntities = await dataScopeService.getUserEntityScopes(featureCode, userId);
      sendSuccess(res, userEntities, 'Danh sách phân quyền đối tượng cho người dùng');
    } catch (err: any) {
      sendError(res, 'Lỗi lấy danh sách phân quyền đối tượng', 500, err.message);
    }
  },

  async assignUserEntities(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { user_id, feature_code, entity_type, entity_ids } = req.body;

      const parsedUserId = parseInt(user_id, 10);
      if (Number.isNaN(parsedUserId) || parsedUserId <= 0) {
        sendError(res, 'user_id không hợp lệ', 400);
        return;
      }

      if (!feature_code || typeof feature_code !== 'string' || !entity_type || typeof entity_type !== 'string') {
        sendError(res, 'feature_code hoặc entity_type không hợp lệ', 400);
        return;
      }

      if (!Array.isArray(entity_ids) || entity_ids.length === 0) {
        sendError(res, 'entity_ids phải là mảng không rỗng', 400);
        return;
      }

      const numericEntityIds = entity_ids.map((id: any) => parseInt(id, 10));
      if (numericEntityIds.some((id: number) => Number.isNaN(id) || id <= 0)) {
        sendError(res, 'Mọi entity_id phải là số nguyên dương hợp lệ', 400);
        return;
      }

      await dataScopeService.assignUserEntities(parsedUserId, feature_code, entity_type, numericEntityIds);
      sendSuccess(res, undefined, 'Gán đối tượng cho người dùng thành công', 201);
    } catch (err: any) {
      if (err instanceof DataScopeError) {
        sendError(res, err.message, err.statusCode, err.code);
        return;
      }
      sendError(res, 'Lỗi gán đối tượng cho người dùng', 500, err.message);
    }
  },

  async removeUserEntityScope(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id) || id <= 0) {
        sendError(res, 'ID không hợp lệ', 400);
        return;
      }
      await dataScopeService.removeUserEntityScope(id);
      sendSuccess(res, undefined, 'Hủy gán đối tượng thành công');
    } catch (err: any) {
      if (err instanceof DataScopeError) {
        sendError(res, err.message, err.statusCode, err.code);
        return;
      }
      sendError(res, 'Lỗi xóa phân quyền đối tượng', 500, err.message);
    }
  },

  async getMyDataScopes(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendError(res, 'Chưa đăng nhập', 401);
        return;
      }

      const summary = await dataScopeService.getUserScopesSummary(
        req.user.userId,
        req.user.roleId,
        req.user.role,
      );
      sendSuccess(res, summary, 'Thông tin phạm vi dữ liệu người dùng');
    } catch (err: any) {
      sendError(res, 'Lỗi lấy thông tin phạm vi dữ liệu', 500, err.message);
    }
  },
};
