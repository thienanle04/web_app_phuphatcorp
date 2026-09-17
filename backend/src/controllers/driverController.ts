import { Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { driverService } from '../services/driverService';
import { sendSuccess, sendError } from '../utils/response';
import { auditService } from '../services/auditService';
import { AuthRequest } from '../middleware/auth';

export const driverCreateSchema = [
  body('user_id')
    .isInt({ min: 1 })
    .withMessage('Tài khoản người dùng là bắt buộc'),
  body('vehicle_ids')
    .isArray()
    .withMessage('Danh sách xe phải là mảng'),
  body('vehicle_ids.*')
    .isInt({ min: 1 })
    .withMessage('ID xe không hợp lệ'),
  body('notes')
    .optional({ nullable: true })
    .isLength({ max: 1000 })
    .withMessage('Ghi chú tối đa 1000 ký tự'),
];

export const driverUpdateSchema = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID không hợp lệ'),
  body('vehicle_ids')
    .isArray()
    .withMessage('Danh sách xe phải là mảng'),
  body('vehicle_ids.*')
    .isInt({ min: 1 })
    .withMessage('ID xe không hợp lệ'),
  body('notes')
    .optional({ nullable: true })
    .isLength({ max: 1000 })
    .withMessage('Ghi chú tối đa 1000 ký tự'),
];

export const driverIdParamSchema = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID không hợp lệ'),
];

export const driverController = {
  async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const search = req.query.search as string | undefined;
      const status = req.query.status as string | undefined;
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;

      const data = await driverService.getAll({ search, status, page, limit });
      sendSuccess(res, data, 'Danh sách tài xế');
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể tải danh sách tài xế', 500, error);
    }
  },

  async getAvailableUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const driverId = req.query.driverId ? parseInt(req.query.driverId as string, 10) : undefined;
      const users = await driverService.getAvailableUsers(driverId);
      sendSuccess(res, users, 'Danh sách người dùng khả dụng');
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể tải danh sách người dùng', 500, error);
    }
  },

  async getAvailableVehicles(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const vehicles = await driverService.getAvailableVehicles();
      sendSuccess(res, vehicles, 'Danh sách xe khả dụng');
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể tải danh sách xe', 500, error);
    }
  },

  async getDriversByVehicle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const vehicleId = parseInt(req.params.vehicleId, 10);
      if (!Number.isInteger(vehicleId) || vehicleId < 1) {
        sendError(res, 'ID xe không hợp lệ', 400);
        return;
      }
      const drivers = await driverService.getDriversByVehicle(vehicleId);
      sendSuccess(res, drivers, 'Danh sách tài xế của xe');
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể tải danh sách tài xế của xe', 500, error);
    }
  },

  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const { user_id, vehicle_ids, notes } = req.body;
      const driver = await driverService.create({
        user_id: parseInt(user_id, 10),
        vehicle_ids: (vehicle_ids || []).map((id: unknown) => parseInt(String(id), 10)),
        notes,
      });

      sendSuccess(res, driver, 'Thêm tài xế thành công', 201);
      auditService.logAudit({
        userId: req.user!.userId,
        username: req.user!.email,
        action: 'CREATE',
        entityType: 'driver',
        entityId: driver.id,
        entityLabel: driver.full_name,
        ipAddress: req.ip,
        details: { user_id, vehicle_ids, notes },
      });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err) {
        const e = err as { code: string; message?: string };
        if (e.code === 'DUPLICATE_DRIVER') {
          sendError(res, e.message || 'Tài khoản người dùng đã được gán làm tài xế', 409);
          return;
        }
        if (e.code === 'INVALID_USER' || e.code === 'INVALID_VEHICLE') {
          sendError(res, e.message || 'Dữ liệu không hợp lệ', 400);
          return;
        }
      }
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể thêm tài xế', 500, error);
    }
  },

  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const id = parseInt(req.params.id, 10);
      const { vehicle_ids, notes } = req.body;
      const driver = await driverService.update(id, {
        vehicle_ids: (vehicle_ids || []).map((vId: unknown) => parseInt(String(vId), 10)),
        notes,
      });

      sendSuccess(res, driver, 'Cập nhật tài xế thành công');
      auditService.logAudit({
        userId: req.user!.userId,
        username: req.user!.email,
        action: 'UPDATE',
        entityType: 'driver',
        entityId: driver.id,
        entityLabel: driver.full_name,
        ipAddress: req.ip,
        details: { vehicle_ids, notes },
      });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err) {
        const e = err as { code: string; message?: string };
        if (e.code === 'NOT_FOUND') {
          sendError(res, 'Không tìm thấy tài xế', 404);
          return;
        }
        if (e.code === 'INVALID_VEHICLE') {
          sendError(res, e.message || 'Dữ liệu không hợp lệ', 400);
          return;
        }
      }
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể cập nhật tài xế', 500, error);
    }
  },

  async toggleStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const id = parseInt(req.params.id, 10);
      const driver = await driverService.toggleStatus(id);
      const label = driver.status === 'active' ? 'kích hoạt' : 'vô hiệu hóa';
      sendSuccess(res, driver, `Đã ${label} tài xế ${driver.full_name}`);
      auditService.logAudit({
        userId: req.user!.userId,
        username: req.user!.email,
        action: driver.status === 'active' ? 'ACTIVATE' : 'DEACTIVATE',
        entityType: 'driver',
        entityId: driver.id,
        entityLabel: driver.full_name,
        ipAddress: req.ip,
      });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err) {
        const e = err as { code: string };
        if (e.code === 'NOT_FOUND') {
          sendError(res, 'Không tìm thấy tài xế', 404);
          return;
        }
      }
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể cập nhật trạng thái tài xế', 500, error);
    }
  },

  async remove(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const id = parseInt(req.params.id, 10);
      await driverService.softDelete(id);
      sendSuccess(res, undefined, 'Đã xóa tài xế');
      auditService.logAudit({
        userId: req.user!.userId,
        username: req.user!.email,
        action: 'DELETE',
        entityType: 'driver',
        entityId: id,
        entityLabel: `Driver #${id}`,
        ipAddress: req.ip,
      });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err) {
        const e = err as { code: string };
        if (e.code === 'NOT_FOUND') {
          sendError(res, 'Không tìm thấy tài xế', 404);
          return;
        }
      }
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể xóa tài xế', 500, error);
    }
  },
};
