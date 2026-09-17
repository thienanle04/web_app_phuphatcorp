import { Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { deliveryPointService } from '../services/deliveryPointService';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../middleware/auth';

export const deliveryPointCreateSchema = [
  body('code')
    .notEmpty().withMessage('Mã là bắt buộc')
    .isLength({ max: 100 }).withMessage('Mã tối đa 100 ký tự'),
  body('address')
    .notEmpty().withMessage('Địa chỉ là bắt buộc')
    .isLength({ max: 500 }).withMessage('Địa chỉ tối đa 500 ký tự'),
  body('notes')
    .optional({ nullable: true })
    .isLength({ max: 1000 }).withMessage('Ghi chú tối đa 1000 ký tự'),
];

export const deliveryPointUpdateSchema = [
  param('id').isInt({ min: 1 }).withMessage('ID không hợp lệ'),
  ...deliveryPointCreateSchema,
];

export const deliveryPointDeleteSchema = [
  param('id').isInt({ min: 1 }).withMessage('ID không hợp lệ'),
];

export const deliveryPointController = {
  async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const search = req.query.search as string | undefined;
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const data = await deliveryPointService.getAll(search, page, limit);
      sendSuccess(res, data, 'Danh sách điểm nhận hàng');
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể tải danh sách', 500, error);
    }
  },

  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const { code, address, notes } = req.body;
      const row = await deliveryPointService.create({ code, address, notes });
      sendSuccess(res, row, 'Thêm điểm nhận hàng thành công', 201);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err) {
        const e = err as { code: string };
        if (e.code === 'DUPLICATE_CODE') {
          sendError(res, 'Mã đã tồn tại', 409);
          return;
        }
      }
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể thêm điểm nhận hàng', 500, error);
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
      const { code, address, notes } = req.body;
      const row = await deliveryPointService.update(id, { code, address, notes });
      sendSuccess(res, row, 'Cập nhật điểm nhận hàng thành công');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err) {
        const e = err as { code: string };
        if (e.code === 'NOT_FOUND') {
          sendError(res, 'Không tìm thấy điểm nhận hàng', 404);
          return;
        }
        if (e.code === 'DUPLICATE_CODE') {
          sendError(res, 'Mã đã tồn tại', 409);
          return;
        }
      }
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể cập nhật điểm nhận hàng', 500, error);
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
      await deliveryPointService.softDelete(id);
      sendSuccess(res, undefined, 'Đã xóa điểm nhận hàng');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err) {
        const e = err as { code: string };
        if (e.code === 'NOT_FOUND') {
          sendError(res, 'Không tìm thấy điểm nhận hàng', 404);
          return;
        }
      }
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể xóa điểm nhận hàng', 500, error);
    }
  },
};
