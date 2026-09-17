import { Response } from 'express';
import { body, param, query, ValidationChain } from 'express-validator';
import { dispatchScheduleService, UpdateDispatchScheduleData } from '../services/dispatchScheduleService';
import { sendSuccess, sendError } from '../utils/response';
import { auditService } from '../services/auditService';
import { AuthRequest } from '../middleware/auth';

export const dispatchListQuerySchema: ValidationChain[] = [
  query('date')
    .notEmpty()
    .withMessage('date là bắt buộc')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('date phải có định dạng YYYY-MM-DD'),
];

export const dispatchCreateSchema: ValidationChain[] = [
  body('ngay')
    .notEmpty()
    .withMessage('Ngày là bắt buộc')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Ngày phải có định dạng YYYY-MM-DD'),
  body('loai_tuyen')
    .notEmpty()
    .withMessage('Loại tuyến là bắt buộc')
    .isIn(['Tuyến cố định', 'Tuyến ngoài'])
    .withMessage("Loại tuyến phải là 'Tuyến cố định' hoặc 'Tuyến ngoài'"),
  body('loai_xe')
    .notEmpty()
    .withMessage('Loại xe là bắt buộc')
    .isIn(['Xe lớn', 'Xe nhỏ'])
    .withMessage("Loại xe phải là 'Xe lớn' hoặc 'Xe nhỏ'"),
  body('xe_type')
    .notEmpty()
    .withMessage('Loại sở hữu là bắt buộc')
    .isIn(['Xe nhà', 'Xe ngoài'])
    .withMessage("Loại sở hữu phải là 'Xe nhà' hoặc 'Xe ngoài'"),
  body('diem_nhan').notEmpty().withMessage('Điểm nhận là bắt buộc'),
  body('tan').optional({ nullable: true }).isString(),
  body('can').optional({ nullable: true }).isString(),
  body('ghi_chu').optional({ nullable: true }).isString(),
];

export const dispatchBatchCreateSchema: ValidationChain[] = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('items phải là array có ít nhất 1 phần tử'),
  body('items.*.ngay')
    .notEmpty()
    .withMessage('Ngày là bắt buộc')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Ngày phải có định dạng YYYY-MM-DD'),
  body('items.*.loai_tuyen')
    .notEmpty()
    .withMessage('Loại tuyến là bắt buộc')
    .isIn(['Tuyến cố định', 'Tuyến ngoài'])
    .withMessage("Loại tuyến phải là 'Tuyến cố định' hoặc 'Tuyến ngoài'"),
  body('items.*.loai_xe')
    .notEmpty()
    .withMessage('Loại xe là bắt buộc')
    .isIn(['Xe lớn', 'Xe nhỏ'])
    .withMessage("Loại xe phải là 'Xe lớn' hoặc 'Xe nhỏ'"),
  body('items.*.bien_so')
    .notEmpty()
    .withMessage('Biển số là bắt buộc')
    .isString(),
  body('items.*.tai_xe').optional({ nullable: true }).isString(),
  body('items.*.vehicle_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('items.*.driver_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('items.*.diem_nhan').notEmpty().withMessage('Điểm nhận là bắt buộc'),
  body('items.*.tan').optional({ nullable: true }).isString(),
  body('items.*.can').optional({ nullable: true }).isString(),
  body('items.*.ghi_chu').optional({ nullable: true }).isString(),
];

export const dispatchUpdateSchema: ValidationChain[] = [
  param('id').isInt({ min: 1 }).withMessage('ID không hợp lệ'),
  body('diem_nhan').notEmpty().withMessage('Điểm nhận là bắt buộc'),
  body('tan').optional({ nullable: true }).isString(),
  body('can').optional({ nullable: true }).isString(),
  body('ghi_chu').optional({ nullable: true }).isString(),
];

export const dispatchDeleteSchema: ValidationChain[] = [
  param('id').isInt({ min: 1 }).withMessage('ID không hợp lệ'),
];

export const dispatchScheduleController = {
  async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      const date = req.query.date as string;
      const data = await dispatchScheduleService.listByDate(date);
      sendSuccess(res, data, 'Danh sách lịch điều phối');
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể tải danh sách lịch điều phối', 500, error);
    }
  },

  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId ?? null;
      const schedule = await dispatchScheduleService.create(req.body, userId);
      sendSuccess(res, schedule, 'Tạo chuyến xe thành công', 201);
      auditService.logAudit({
        userId: req.user!.userId,
        username: req.user!.email,
        action: 'CREATE',
        entityType: 'dispatch_schedule',
        entityId: schedule.id,
        entityLabel: `Dispatch #${schedule.id}`,
        ipAddress: req.ip,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể tạo chuyến xe', 500, error);
    }
  },

  async batchCreate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId ?? null;
      const { items } = req.body;
      const schedules = await dispatchScheduleService.createBatch(items, userId);
      sendSuccess(res, schedules, `Tạo ${schedules.length} chuyến xe thành công`, 201);
      for (const schedule of schedules) {
        auditService.logAudit({
          userId: req.user!.userId,
          username: req.user!.email,
          action: 'CREATE',
          entityType: 'dispatch_schedule',
          entityId: schedule.id,
          entityLabel: `Dispatch #${schedule.id}`,
          ipAddress: req.ip,
        });
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể tạo chuyến xe', 500, error);
    }
  },

  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const data: UpdateDispatchScheduleData = req.body;
      const schedule = await dispatchScheduleService.update(id, data);
      if (!schedule) {
        sendError(res, 'Không tìm thấy chuyến xe', 404);
        return;
      }
      sendSuccess(res, schedule, 'Cập nhật chuyến xe thành công');
      auditService.logAudit({
        userId: req.user!.userId,
        username: req.user!.email,
        action: 'UPDATE',
        entityType: 'dispatch_schedule',
        entityId: id,
        entityLabel: `Dispatch #${id}`,
        ipAddress: req.ip,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể cập nhật chuyến xe', 500, error);
    }
  },

  async remove(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const deleted = await dispatchScheduleService.remove(id);
      if (!deleted) {
        sendError(res, 'Không tìm thấy chuyến xe', 404);
        return;
      }
      sendSuccess(res, null, 'Đã xóa chuyến xe');
      auditService.logAudit({
        userId: req.user!.userId,
        username: req.user!.email,
        action: 'DELETE',
        entityType: 'dispatch_schedule',
        entityId: id,
        entityLabel: `Dispatch #${id}`,
        ipAddress: req.ip,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể xóa chuyến xe', 500, error);
    }
  },
};
