import { Response } from 'express';
import { body, param, query, ValidationChain } from 'express-validator';
import { AuthRequest } from '../middleware/auth';
import { customerSurchargeService } from '../services/customerSurchargeService';
import { sendError, sendSuccess } from '../utils/response';
import { auditService } from '../services/auditService';

const ERRORS: Record<string, { status: number; message: string }> = {
  CUSTOMER_NAME_UNKNOWN: { status: 400, message: 'Không có khách đang hoạt động với tên này' },
  POINT_NAME_MISMATCH: { status: 400, message: 'Điểm trả không thuộc khách đã chọn' },
  POINT_WITHOUT_ADDRESS: { status: 400, message: 'Điểm này không có địa chỉ giao hàng' },
  POINT_NOT_FOUND: { status: 404, message: 'Không tìm thấy điểm trả' },
  INVALID_AMOUNT: { status: 400, message: 'Đơn giá phải là số nguyên từ 0' },
  INVALID_FEE_CONDITION: { status: 400, message: 'Điều kiện phụ phí không hợp lệ' },
  RULE_OPEN_EXISTS: { status: 409, message: 'Combo này đang mở. Đổi giá hoặc ngừng trước' },
  RULE_OVERLAP: { status: 409, message: 'Khoảng ngày chồng với rule cùng combo' },
  RULE_AMBIGUOUS: { status: 409, message: 'Rule này trùng độ khớp với rule đang mở' },
  CLOSED_RULE_IMMUTABLE: { status: 409, message: 'Rule đã đóng, không đổi được' },
  START_NOT_AFTER_OPEN: { status: 400, message: 'Ngày mới phải sau ngày bắt đầu hiện tại' },
  SURCHARGE_NOT_FOUND: { status: 404, message: 'Không tìm thấy phụ phí' },
  POINT_NOT_ALLOWED_FOR_BATCH: { status: 400, message: 'Không gắn điểm trả khi tạo cho nhiều khách' },
};

function handleError(res: Response, err: unknown): void {
  const batch = err as { code?: string; failures?: { ten_khach_hang: string; code: string }[] };
  if (batch.code === 'BATCH_REJECTED' && Array.isArray(batch.failures)) {
    const conflict = batch.failures.some((item) => item.code !== 'CUSTOMER_NAME_UNKNOWN');
    sendError(res, 'Không lưu được', conflict ? 409 : 400, 'BATCH_REJECTED', { failures: batch.failures });
    return;
  }
  const code = batch.code;
  const mapped = code ? ERRORS[code] : undefined;
  if (mapped) {
    sendError(res, mapped.message, mapped.status, code);
    return;
  }
  const message = err instanceof Error ? err.message : 'Unknown error';
  sendError(res, 'Không thể xử lý phụ phí', 500, message);
}

export const surchargeListSchema: ValidationChain[] = [
  query('page').optional().isInt({ min: 1 }),
  query('page_size').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['open', 'closed', 'all']),
  query('fee_type').optional().isIn(['boc_xep', 'phu_phi_giao_hang', 'chuyen_tai']),
  query('zone').optional().isIn(['noi_thanh', 'tinh']),
  query('vehicle_class').optional().isIn(['le_2_5', 'gt_8_16', 'gt_16_23', 'pallet']),
];

export const surchargeCreateSchema: ValidationChain[] = [
  body('ten_khach_hang').optional({ nullable: true }).trim().isLength({ max: 255 }),
  body('ten_khach_hangs').optional({ nullable: true }).isArray({ min: 1 }),
  body('customer_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('fee_type').isIn(['boc_xep', 'phu_phi_giao_hang', 'chuyen_tai']),
  body('zone').optional({ nullable: true }).isIn(['noi_thanh', 'tinh']),
  body('vehicle_class').optional({ nullable: true }).isIn(['le_2_5', 'gt_8_16', 'gt_16_23', 'pallet']),
  body('amount').isInt({ min: 0 }),
  body('start_date').matches(/^\d{4}-\d{2}-\d{2}$/),
];

export const surchargeReplaceSchema: ValidationChain[] = [
  param('id').isInt({ min: 1 }),
  body('amount').isInt({ min: 0 }),
  body('start_date').matches(/^\d{4}-\d{2}-\d{2}$/),
];

export const surchargeDeleteSchema: ValidationChain[] = [
  param('id').isInt({ min: 1 }),
];

export const surchargeStopSchema: ValidationChain[] = [
  param('id').isInt({ min: 1 }),
  body('end_date').optional({ nullable: true }).matches(/^\d{4}-\d{2}-\d{2}$/),
];

export const surchargeLookupSchema: ValidationChain[] = [
  body('ten_khach_hang').trim().notEmpty(),
  body('dia_chi_giao_hang').optional({ nullable: true }).isString(),
  body('zone').isIn(['noi_thanh', 'tinh']),
  body('vehicle_class').isIn(['le_2_5', 'gt_8_16', 'gt_16_23', 'pallet']),
  body('on_date').matches(/^\d{4}-\d{2}-\d{2}$/),
  body('supplier_code').optional({ nullable: true }).isString().isLength({ max: 50 }),
];

export const customerSurchargeController = {
  async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = await customerSurchargeService.list({
        ten_khach_hang: req.query.ten_khach_hang as string | undefined,
        fee_type: req.query.fee_type as string | undefined,
        zone: req.query.zone as string | undefined,
        vehicle_class: req.query.vehicle_class as string | undefined,
        status: req.query.status as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        page_size: req.query.page_size ? Number(req.query.page_size) : undefined,
      });
      sendSuccess(res, data, 'Danh sách phụ phí');
    } catch (err) {
      handleError(res, err);
    }
  },

  async customerOptions(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = await customerSurchargeService.customerOptions();
      sendSuccess(res, data, 'Khách cho phụ phí');
    } catch (err) {
      handleError(res, err);
    }
  },

  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const listed = Array.isArray(req.body.ten_khach_hangs) ? req.body.ten_khach_hangs as string[] : [];
      const names = listed.length > 0 ? listed : [String(req.body.ten_khach_hang ?? '')];
      const items = await customerSurchargeService.createBatch({
        names,
        customer_id: req.body.customer_id ?? null,
        fee_type: req.body.fee_type,
        zone: req.body.zone,
        vehicle_class: req.body.vehicle_class,
        amount: Number(req.body.amount),
        start_date: req.body.start_date,
      }, req.user!.userId);
      sendSuccess(res, { items }, items.length > 1 ? `Đã thêm ${items.length} phụ phí` : 'Đã thêm phụ phí', 201);
    } catch (err) {
      handleError(res, err);
    }
  },

  async replace(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = await customerSurchargeService.replace(Number(req.params.id), req.body, req.user!.userId);
      sendSuccess(res, data, 'Đã đổi giá');
    } catch (err) {
      handleError(res, err);
    }
  },

  async stop(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = await customerSurchargeService.stop(
        Number(req.params.id),
        req.body.end_date,
        req.user!.userId,
      );
      sendSuccess(res, data, 'Đã ngừng phụ phí');
    } catch (err) {
      handleError(res, err);
    }
  },

  async remove(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      const rule = await customerSurchargeService.remove(id);
      sendSuccess(res, undefined, 'Đã xóa phụ phí');
      auditService.logAudit({
        userId: req.user!.userId,
        username: req.user!.email,
        action: 'DELETE',
        entityType: 'customer_surcharge_rule',
        entityId: id,
        entityLabel: `${rule.ten_khach_hang} ${rule.fee_type}`,
        details: {
          ten_khach_hang: rule.ten_khach_hang,
          customer_id: rule.customer_id,
          fee_type: rule.fee_type,
          zone: rule.zone,
          vehicle_class: rule.vehicle_class,
          amount: rule.amount,
          pricing_unit: rule.pricing_unit,
          start_date: rule.start_date,
          end_date: rule.end_date,
        },
        ipAddress: req.ip,
      });
    } catch (err) {
      handleError(res, err);
    }
  },
  async lookup(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = await customerSurchargeService.lookup(req.body);
      sendSuccess(res, data, 'Kết quả tra cứu');
    } catch (err) {
      handleError(res, err);
    }
  },
};
