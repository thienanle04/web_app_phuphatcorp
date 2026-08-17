import { Response } from 'express';
import { body, param, ValidationChain } from 'express-validator';
import { customerService } from '../services/customerService';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { auditService } from '../services/auditService';

export const customerCreateSchema: ValidationChain[] = [
  body('diem_tra_hang')
    .notEmpty().withMessage('Điểm trả hàng là bắt buộc')
    .isLength({ max: 255 }).withMessage('Điểm trả hàng tối đa 255 ký tự'),
  body('ten_khach_hang')
    .notEmpty().withMessage('Tên khách hàng là bắt buộc')
    .isLength({ max: 500 }).withMessage('Tên khách hàng tối đa 500 ký tự'),
  body('tuyen_phuong')
    .optional({ nullable: true })
    .isLength({ max: 255 }).withMessage('Tuyến-phường tối đa 255 ký tự'),
  body('tuyen_cu')
    .optional({ nullable: true })
    .isLength({ max: 255 }).withMessage('Tuyến-cũ tối đa 255 ký tự'),
  body('dia_chi_giao_hang')
    .optional({ nullable: true }),
  body('diem_giao_hang_tinh_phi')
    .optional({ nullable: true })
    .isLength({ max: 255 }).withMessage('Điểm giao hàng tính phí tối đa 255 ký tự'),
  body('boc_xep')
    .isBoolean().withMessage('Bốc xếp phải là boolean'),
  body('supplier_code')
    .optional({ nullable: true })
    .isLength({ max: 20 }).withMessage('Mã nhà cung cấp tối đa 20 ký tự'),
];

export const customerUpdateSchema: ValidationChain[] = [
  param('id').isInt({ min: 1 }).withMessage('ID không hợp lệ'),
  ...customerCreateSchema,
];

export const customerDeleteSchema: ValidationChain[] = [
  param('id').isInt({ min: 1 }).withMessage('ID không hợp lệ'),
];

export const customerUploadSchema: ValidationChain[] = [
  body('rows').isArray({ min: 1 }).withMessage('Dữ liệu upload không được trống'),
  body('rows.*.diem_tra_hang')
    .notEmpty().withMessage('Điểm trả hàng là bắt buộc')
    .isLength({ max: 255 }).withMessage('Điểm trả hàng tối đa 255 ký tự'),
  body('rows.*.ten_khach_hang')
    .notEmpty().withMessage('Tên khách hàng là bắt buộc')
    .isLength({ max: 500 }).withMessage('Tên khách hàng tối đa 500 ký tự'),
  body('rows.*.boc_xep')
    .isBoolean().withMessage('Bốc xếp phải là boolean'),
  body('rows.*.supplier_code')
    .optional({ nullable: true })
    .isLength({ max: 20 }).withMessage('Mã nhà cung cấp tối đa 20 ký tự'),
  body('rows.*.diem_giao_hang_tinh_phi')
    .optional({ nullable: true })
    .isLength({ max: 255 }).withMessage('Điểm giao hàng tính phí tối đa 255 ký tự'),
];

export const customerController = {
  async list(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = await customerService.list();
      sendSuccess(res, data, 'Danh sách khách hàng');
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể tải danh sách khách hàng', 500, error);
    }
  },

  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { diem_tra_hang, ten_khach_hang, tuyen_phuong, tuyen_cu, dia_chi_giao_hang, diem_giao_hang_tinh_phi, boc_xep, supplier_code } = req.body;
      const row = await customerService.create({
        diem_tra_hang,
        ten_khach_hang,
        tuyen_phuong,
        tuyen_cu,
        dia_chi_giao_hang,
        diem_giao_hang_tinh_phi,
        boc_xep,
        supplier_code,
      });
      sendSuccess(res, row, 'Thêm khách hàng thành công', 201);

      auditService.logAudit({
        userId: req.user!.userId,
        username: req.user!.email,
        action: 'CREATE',
        entityType: 'customer',
        entityId: row.id,
        entityLabel: row.ten_khach_hang || row.diem_tra_hang,
        ipAddress: req.ip,
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể thêm khách hàng', 500, error);
    }
  },

  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const { diem_tra_hang, ten_khach_hang, tuyen_phuong, tuyen_cu, dia_chi_giao_hang, diem_giao_hang_tinh_phi, boc_xep, supplier_code } = req.body;
      const row = await customerService.update(id, {
        diem_tra_hang,
        ten_khach_hang,
        tuyen_phuong,
        tuyen_cu,
        dia_chi_giao_hang,
        diem_giao_hang_tinh_phi,
        boc_xep,
        supplier_code,
      });
      sendSuccess(res, row, 'Cập nhật khách hàng thành công');

      auditService.logAudit({
        userId: req.user!.userId,
        username: req.user!.email,
        action: 'UPDATE',
        entityType: 'customer',
        entityId: id,
        entityLabel: row.ten_khach_hang || row.diem_tra_hang,
        ipAddress: req.ip,
      });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err) {
        const e = err as { code: string };
        if (e.code === 'NOT_FOUND') {
          sendError(res, 'Không tìm thấy khách hàng', 404);
          return;
        }
      }
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể cập nhật khách hàng', 500, error);
    }
  },

  async remove(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      await customerService.softDelete(id);
      sendSuccess(res, undefined, 'Đã xóa khách hàng');

      auditService.logAudit({
        userId: req.user!.userId,
        username: req.user!.email,
        action: 'DELETE',
        entityType: 'customer',
        entityId: id,
        entityLabel: `Customer #${id}`,
        ipAddress: req.ip,
      });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err) {
        const e = err as { code: string };
        if (e.code === 'NOT_FOUND') {
          sendError(res, 'Không tìm thấy khách hàng', 404);
          return;
        }
      }
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể xóa khách hàng', 500, error);
    }
  },

  async upload(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { rows } = req.body;
      const result = await customerService.uploadMany(rows);
      sendSuccess(res, result, `Đã import ${result.inserted} khách hàng thành công`, 201);

      auditService.logAudit({
        userId: req.user!.userId,
        username: req.user!.email,
        action: 'UPLOAD',
        entityType: 'customer',
        entityLabel: 'Batch upload',
        details: { inserted: result.inserted, total: rows.length },
        ipAddress: req.ip,
      });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err) {
        const e = err as { code: string; errors?: unknown[] };
        if (e.code === 'UPLOAD_ERRORS') {
          res.status(422).json({
            success: false,
            message: 'Upload thất bại — có lỗi dữ liệu',
            data: { errors: e.errors },
          });
          return;
        }
      }
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể upload dữ liệu', 500, error);
    }
  },
};
