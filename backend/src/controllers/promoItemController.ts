import { Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { promoItemService } from '../services/promoItemService';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../middleware/auth';

export const promoItemCreateSchema = [
  body('code')
    .notEmpty().withMessage('Mã là bắt buộc')
    .isLength({ max: 100 }).withMessage('Mã tối đa 100 ký tự'),
  body('product_name')
    .notEmpty().withMessage('Tên hàng hóa là bắt buộc')
    .isLength({ max: 255 }).withMessage('Tên hàng hóa tối đa 255 ký tự'),
  body('unit_weight_kg')
    .isNumeric().withMessage('Trọng lượng phải là số')
    .custom((v) => parseFloat(v) >= 0).withMessage('Trọng lượng phải >= 0'),
];

export const promoItemUpdateSchema = [
  param('id').isInt({ min: 1 }).withMessage('ID không hợp lệ'),
  ...promoItemCreateSchema,
];

export const promoItemDeleteSchema = [
  param('id').isInt({ min: 1 }).withMessage('ID không hợp lệ'),
];

export const promoItemController = {
  async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const search = req.query.search as string | undefined;
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const data = await promoItemService.getAll(search, page, limit);
      sendSuccess(res, data, 'Danh sách hàng khuyến mãi');
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

      const { code, product_name, unit_weight_kg } = req.body;
      const row = await promoItemService.create({
        code,
        product_name,
        unit_weight_kg: parseFloat(unit_weight_kg),
      });
      sendSuccess(res, row, 'Thêm hàng khuyến mãi thành công', 201);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err) {
        const e = err as { code: string };
        if (e.code === 'DUPLICATE_CODE') {
          sendError(res, 'Mã đã tồn tại', 409);
          return;
        }
      }
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể thêm hàng khuyến mãi', 500, error);
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
      const { code, product_name, unit_weight_kg } = req.body;
      const row = await promoItemService.update(id, {
        code,
        product_name,
        unit_weight_kg: parseFloat(unit_weight_kg),
      });
      sendSuccess(res, row, 'Cập nhật hàng khuyến mãi thành công');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err) {
        const e = err as { code: string };
        if (e.code === 'NOT_FOUND') {
          sendError(res, 'Không tìm thấy hàng khuyến mãi', 404);
          return;
        }
        if (e.code === 'DUPLICATE_CODE') {
          sendError(res, 'Mã đã tồn tại', 409);
          return;
        }
      }
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể cập nhật hàng khuyến mãi', 500, error);
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
      await promoItemService.softDelete(id);
      sendSuccess(res, undefined, 'Đã xóa hàng khuyến mãi');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err) {
        const e = err as { code: string };
        if (e.code === 'NOT_FOUND') {
          sendError(res, 'Không tìm thấy hàng khuyến mãi', 404);
          return;
        }
      }
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể xóa hàng khuyến mãi', 500, error);
    }
  },
};
