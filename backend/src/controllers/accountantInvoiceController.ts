import { Response } from 'express';
import { query, param, body, ValidationChain } from 'express-validator';
import { accountantInvoiceService } from '../services/accountantInvoiceService';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../middleware/auth';

export const listInvoicesSchema: ValidationChain[] = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be >= 1'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
  query('batch_id').optional().isString(),
  query('ngay_from').optional().isString(),
  query('ngay_to').optional().isString(),
  query('so_xe').optional().isString(),
  query('so_hoa_don').optional().isString(),
  query('trang_thai').optional().isString(),
];

export const missingSummarySchema: ValidationChain[] = [
  query('batch_id').optional().isString(),
  query('in_catalog').optional().isBoolean().withMessage('in_catalog phải là true hoặc false'),
];

export const updateInvoiceSchema: ValidationChain[] = [
  param('id').isInt({ min: 1 }).withMessage('ID không hợp lệ'),
  body('trang_thai')
    .notEmpty().withMessage('Trạng thái là bắt buộc')
    .isIn(['không có', 'xe không chạy', 'data sai', 'data khác']).withMessage('Trạng thái không hợp lệ'),
  body('ghi_chu').optional({ nullable: true }),
  body('so_xe').optional().isLength({ max: 100 }).withMessage('Số xe tối đa 100 ký tự'),
];

export const accountantInvoiceController = {
  async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      const filters = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        batch_id: req.query.batch_id as string | undefined,
        ngay_from: req.query.ngay_from as string | undefined,
        ngay_to: req.query.ngay_to as string | undefined,
        so_xe: req.query.so_xe as string | undefined,
        so_hoa_don: req.query.so_hoa_don as string | undefined,
        trang_thai: req.query.trang_thai as string | undefined,
      };
      const result = await accountantInvoiceService.list(filters);
      sendSuccess(res, result, 'Danh sách hóa đơn kế toán');
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể tải danh sách hóa đơn kế toán', 500, error);
    }
  },

  async missingSummary(req: AuthRequest, res: Response): Promise<void> {
    try {
      const batchId = req.query.batch_id as string | undefined;
      const inCatalog = req.query.in_catalog !== undefined
        ? req.query.in_catalog === 'true'
        : undefined;
      const result = await accountantInvoiceService.getMissingSummary(batchId, inCatalog);
      sendSuccess(res, result, 'Danh sách hóa đơn thiếu theo số xe');
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể tải danh sách hóa đơn thiếu', 500, error);
    }
  },

  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const { trang_thai, ghi_chu, so_xe } = req.body;
      const row = await accountantInvoiceService.update(id, { trang_thai, ghi_chu: ghi_chu ?? null, so_xe });
      sendSuccess(res, row, 'Cập nhật hóa đơn thành công');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err) {
        const e = err as { code: string };
        if (e.code === 'NOT_FOUND') {
          sendError(res, 'Không tìm thấy hóa đơn', 404);
          return;
        }
        if (e.code === 'CANNOT_EDIT') {
          sendError(res, 'Không thể sửa hóa đơn đã có', 400);
          return;
        }
      }
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể cập nhật hóa đơn', 500, error);
    }
  },
};
