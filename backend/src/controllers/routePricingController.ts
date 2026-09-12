import { Response } from 'express';
import { body, param, query, ValidationChain } from 'express-validator';
import { AuthRequest } from '../middleware/auth';
import { routePricingService } from '../services/routePricingService';
import { sendError, sendSuccess } from '../utils/response';

function handleServiceError(res: Response, err: unknown, fallback: string): void {
  const e = err as { code?: string; message?: string };
  const code = e?.code;
  const map: Record<string, { status: number; message: string }> = {
    MISSING_PRICE_BOOK: { status: 400, message: 'Thiếu bảng giá' },
    PRICE_BOOK_NOT_FOUND: { status: 404, message: 'Không tìm thấy bảng giá' },
    DUPLICATE_PRICE_BOOK: { status: 409, message: 'Tên bảng giá đã tồn tại' },
    INVALID_PRICE_BOOK_NAME: { status: 400, message: e.message || 'Tên bảng giá không hợp lệ' },
    LOOKUP_DEFERRED: { status: 501, message: 'Lookup sẽ được cập nhật sau khi chuyển sang bảng giá' },
    MISSING_PROVINCE: { status: 400, message: 'Thiếu tỉnh' },
    NOT_FOUND: { status: 404, message: e.message || 'Không tìm thấy' },
    INVALID_WARD: { status: 400, message: e.message || 'Phường/tỉnh không hợp lệ' },
    DUPLICATE_ROUTE: { status: 409, message: 'Tuyến đã tồn tại (cùng đích và ghi chú)' },
    ROUTE_IN_ACTIVE_GROUP: { status: 409, message: 'Tuyến đang thuộc nhóm, hãy gỡ khỏi nhóm trước' },
    DUPLICATE_RESIDUAL_GROUP: {
      status: 409,
      message: 'Đã có nhóm còn lại với cùng ghi chú cho tỉnh này',
    },
    DUPLICATE_GROUP_NAME: { status: 409, message: 'Tên nhóm đã tồn tại' },
    PERIOD_REQUIRED: { status: 400, message: e.message || 'Cần chọn kỳ điều chỉnh' },
    INVALID_PERIOD: { status: 400, message: e.message || 'Kỳ điều chỉnh không hợp lệ' },
    DUPLICATE_PERIOD: { status: 409, message: e.message || 'Kỳ điều chỉnh đã tồn tại' },
    PERIOD_NOT_LATEST: { status: 409, message: e.message || 'Chỉ được xóa kỳ gần nhất' },
    ABSOLUTE_UPDATE_FORBIDDEN: { status: 400, message: 'Đã có giá — chỉ được cập nhật bằng điều chỉnh %' },
    OVERLAPPING_VERSION: { status: 409, message: 'Đã có phiên bản trùng kỳ điều chỉnh' },
    INVALID_TIERS: { status: 400, message: e.message || 'Bậc điều kiện không hợp lệ' },
    INVALID_DESTINATION: {
      status: 400,
      message: e.message || 'Chỉ chọn phường hoặc địa điểm, không chọn cả hai',
    },
    AMBIGUOUS_ROUTE: { status: 409, message: e.message || 'Khớp nhiều nhóm tuyến' },
    ROUTE_ALREADY_IN_GROUP: { status: 409, message: 'Phường đã thuộc nhóm khác' },
  };
  if (code && map[code]) {
    sendError(res, map[code].message, map[code].status, code);
    return;
  }
  const msg = err instanceof Error ? err.message : 'Unknown error';
  sendError(res, fallback, 500, msg);
}

export const priceBookCreateSchema: ValidationChain[] = [
  body('name').isString().trim().notEmpty().withMessage('name là bắt buộc'),
];

export const priceBookUpdateSchema: ValidationChain[] = [
  param('id').isInt({ min: 1 }),
  body('name').isString().trim().notEmpty().withMessage('name là bắt buộc'),
];

export const priceBookDeleteSchema: ValidationChain[] = [
  param('id').isInt({ min: 1 }),
];

export const geoWardsSchema: ValidationChain[] = [
  query('province_code').notEmpty().withMessage('province_code là bắt buộc'),
];

export const routesListSchema: ValidationChain[] = [
  query('price_book_id').isInt({ min: 1 }).withMessage('price_book_id là bắt buộc'),
];

export const routeCreateSchema: ValidationChain[] = [
  body('price_book_id').isInt({ min: 1 }).withMessage('price_book_id là bắt buộc'),
  body('province_code').notEmpty().withMessage('province_code là bắt buộc'),
  body('ward_code').optional({ nullable: true }).isString(),
  body('location_text').optional({ nullable: true }).isString(),
  body('note').optional({ nullable: true }).isString(),
];

export const routeUpdateSchema: ValidationChain[] = [
  param('id').isInt({ min: 1 }),
  body('province_code').notEmpty().withMessage('province_code là bắt buộc'),
  body('ward_code').optional({ nullable: true }).isString(),
  body('location_text').optional({ nullable: true }).isString(),
  body('note').optional({ nullable: true }).isString(),
];

export const routeDeleteSchema: ValidationChain[] = [
  param('id').isInt({ min: 1 }),
];

export const groupsListSchema: ValidationChain[] = [
  query('price_book_id').isInt({ min: 1 }).withMessage('price_book_id là bắt buộc'),
];

export const groupCreateSchema: ValidationChain[] = [
  body('price_book_id').isInt({ min: 1 }).withMessage('price_book_id là bắt buộc'),
  body('province_code').notEmpty().withMessage('province_code là bắt buộc'),
  body('ward_codes').optional().isArray(),
  body('ward_codes.*').optional().isString(),
  body('location_text').optional({ nullable: true }).isString(),
  body('note').optional({ nullable: true }),
];

export const groupUpdateSchema: ValidationChain[] = [
  param('id').isInt({ min: 1 }),
  body('ward_codes').optional().isArray(),
  body('ward_codes.*').optional().isString(),
  body('location_text').optional({ nullable: true }).isString(),
  body('note').optional({ nullable: true }),
];

export const groupDeleteSchema: ValidationChain[] = [
  param('id').isInt({ min: 1 }),
];

export const pricesListSchema: ValidationChain[] = [
  query('price_book_id').isInt({ min: 1 }).withMessage('price_book_id là bắt buộc'),
];

export const pricesMatrixSchema: ValidationChain[] = [
  query('price_book_id').isInt({ min: 1 }).withMessage('price_book_id là bắt buộc'),
];

export const priceCreateSchema: ValidationChain[] = [
  body('route_group_id').isInt({ min: 1 }),
  body('adjustment_period_id').isInt({ min: 1 }).withMessage('adjustment_period_id là bắt buộc'),
  body('pricing_mode').isIn(['by_weight', 'by_trips', 'by_truck']).withMessage('pricing_mode không hợp lệ'),
  body('pallet_trip_price').isFloat({ min: 0 }).withMessage('Giá Pallet phải ≥ 0'),
  body('tiers').isArray({ min: 1 }),
  body('tiers.*.range_from').optional({ nullable: true }).isFloat({ min: 0 }),
  body('tiers.*.label').optional({ nullable: true }).isString().isLength({ max: 255 }),
  body('tiers.*.range_to')
    .optional({ nullable: true })
    .customSanitizer((v) => (v === '' || v === undefined ? null : v))
    .custom((v) => v == null || (typeof v === 'number' ? !Number.isNaN(v) : !Number.isNaN(parseFloat(String(v)))))
    .withMessage('range_to phải là số hoặc null'),
  body('tiers.*.pricing_unit').isIn(['chuyen', 'tan']),
  body('tiers.*.price').isFloat({ gt: 0 }),
  body('tiers.*.min_billable_ton')
    .optional({ nullable: true })
    .customSanitizer((v) => {
      if (v === '' || v === undefined || v === null || Number(v) === 0) return null;
      return v;
    })
    .custom((v) => v == null || (typeof v === 'number' ? v > 0 : parseFloat(String(v)) > 0))
    .withMessage('min_billable_ton phải > 0 hoặc để trống'),
];

export const priceUpdateAbsoluteSchema: ValidationChain[] = [
  param('routeGroupId').isInt({ min: 1 }),
  body('pricing_mode').isIn(['by_weight', 'by_trips', 'by_truck']).withMessage('pricing_mode không hợp lệ'),
  body('pallet_trip_price').isFloat({ min: 0 }).withMessage('Giá Pallet phải ≥ 0'),
  body('tiers').isArray({ min: 1 }),
  body('tiers.*.range_from').optional({ nullable: true }).isFloat({ min: 0 }),
  body('tiers.*.label').optional({ nullable: true }).isString().isLength({ max: 255 }),
  body('tiers.*.range_to')
    .optional({ nullable: true })
    .customSanitizer((v) => (v === '' || v === undefined ? null : v))
    .custom((v) => v == null || (typeof v === 'number' ? !Number.isNaN(v) : !Number.isNaN(parseFloat(String(v)))))
    .withMessage('range_to phải là số hoặc null'),
  body('tiers.*.pricing_unit').isIn(['chuyen', 'tan']),
  body('tiers.*.price').isFloat({ gt: 0 }),
  body('tiers.*.min_billable_ton')
    .optional({ nullable: true })
    .customSanitizer((v) => {
      if (v === '' || v === undefined || v === null || Number(v) === 0) return null;
      return v;
    })
    .custom((v) => v == null || (typeof v === 'number' ? v > 0 : parseFloat(String(v)) > 0))
    .withMessage('min_billable_ton phải > 0 hoặc để trống'),
];

export const periodCreateSchema: ValidationChain[] = [
  body('start_date').notEmpty().isISO8601().toDate(),
  body('percent').isFloat().withMessage('percent là bắt buộc'),
  body('note').optional({ nullable: true }),
];

export const periodDeleteSchema: ValidationChain[] = [
  param('id').isInt({ min: 1 }),
];

export const versionsSchema: ValidationChain[] = [
  param('configId').isInt({ min: 1 }),
];

export const lookupSchema: ValidationChain[] = [
  query('supplier_id').isInt({ min: 1 }),
];

export const routePricingController = {
  async listProvinces(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = await routePricingService.listProvinces();
      sendSuccess(res, data, 'Danh sách tỉnh');
    } catch (err) {
      handleServiceError(res, err, 'Không tải được danh sách tỉnh');
    }
  },

  async listWards(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = await routePricingService.listWards(String(req.query.province_code));
      sendSuccess(res, data, 'Danh sách phường');
    } catch (err) {
      handleServiceError(res, err, 'Không tải được danh sách phường');
    }
  },

  async listPriceBooks(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = await routePricingService.listPriceBooks();
      sendSuccess(res, data, 'Danh sách bảng giá');
    } catch (err) {
      handleServiceError(res, err, 'Không tải được danh sách bảng giá');
    }
  },

  async createPriceBook(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = await routePricingService.createPriceBook(String(req.body.name), req.user!.userId);
      sendSuccess(res, data, 'Đã tạo bảng giá', 201);
    } catch (err) {
      handleServiceError(res, err, 'Không tạo được bảng giá');
    }
  },

  async updatePriceBook(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const data = await routePricingService.updatePriceBook(id, String(req.body.name), req.user!.userId);
      sendSuccess(res, data, 'Đã đổi tên bảng giá');
    } catch (err) {
      handleServiceError(res, err, 'Không đổi tên được bảng giá');
    }
  },

  async deletePriceBook(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      await routePricingService.deletePriceBook(id, req.user!.userId);
      sendSuccess(res, null, 'Đã xóa bảng giá');
    } catch (err) {
      handleServiceError(res, err, 'Không xóa được bảng giá');
    }
  },

  async listRoutes(req: AuthRequest, res: Response): Promise<void> {
    try {
      const priceBookId = parseInt(String(req.query.price_book_id), 10);
      const data = await routePricingService.listRoutes(priceBookId, {
        search: req.query.search as string | undefined,
        province_code: req.query.province_code as string | undefined,
        status: (req.query.status as string) || 'active',
      });
      sendSuccess(res, data, 'Danh sách tuyến');
    } catch (err) {
      handleServiceError(res, err, 'Không tải được danh sách tuyến');
    }
  },

  async createRoute(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = await routePricingService.createRoute(req.body, req.user!.userId);
      sendSuccess(res, data, 'Đã tạo tuyến', 201);
    } catch (err) {
      handleServiceError(res, err, 'Không tạo được tuyến');
    }
  },

  async updateRoute(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const data = await routePricingService.updateRoute(id, req.body, req.user!.userId);
      sendSuccess(res, data, 'Đã cập nhật tuyến');
    } catch (err) {
      handleServiceError(res, err, 'Không cập nhật được tuyến');
    }
  },

  async deleteRoute(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      await routePricingService.softDeleteRoute(id);
      sendSuccess(res, null, 'Đã xóa tuyến');
    } catch (err) {
      handleServiceError(res, err, 'Không xóa được tuyến');
    }
  },

  async listGroups(req: AuthRequest, res: Response): Promise<void> {
    try {
      const priceBookId = parseInt(String(req.query.price_book_id), 10);
      const data = await routePricingService.listGroups(priceBookId, {
        province_code: req.query.province_code as string | undefined,
        search: req.query.search as string | undefined,
      });
      sendSuccess(res, data, 'Danh sách nhóm');
    } catch (err) {
      handleServiceError(res, err, 'Không tải được danh sách nhóm');
    }
  },

  async createGroup(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = await routePricingService.createGroup(
        {
          price_book_id: req.body.price_book_id,
          province_code: req.body.province_code,
          ward_codes: req.body.ward_codes,
          location_text: req.body.location_text,
          note: req.body.note,
        },
        req.user!.userId,
      );
      sendSuccess(res, data, 'Đã tạo nhóm', 201);
    } catch (err) {
      handleServiceError(res, err, 'Không tạo được nhóm');
    }
  },

  async updateGroup(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const data = await routePricingService.updateGroup(
        id,
        {
          note: req.body.note,
          ward_codes: req.body.ward_codes,
          location_text: req.body.location_text,
        },
        req.user!.userId,
      );
      sendSuccess(res, data, 'Đã cập nhật nhóm');
    } catch (err) {
      handleServiceError(res, err, 'Không cập nhật được nhóm');
    }
  },

  async deleteGroup(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      await routePricingService.softDeleteGroup(id, req.user!.userId);
      sendSuccess(res, null, 'Đã xóa nhóm');
    } catch (err) {
      handleServiceError(res, err, 'Không xóa được nhóm');
    }
  },

  async listPrices(req: AuthRequest, res: Response): Promise<void> {
    try {
      const priceBookId = parseInt(String(req.query.price_book_id), 10);
      const groupId = req.query.route_group_id
        ? parseInt(String(req.query.route_group_id), 10)
        : undefined;
      const data = await routePricingService.listPrices(priceBookId, groupId);
      sendSuccess(res, data, 'Danh sách bảng giá');
    } catch (err) {
      handleServiceError(res, err, 'Không tải được bảng giá');
    }
  },

  async getPriceMatrix(req: AuthRequest, res: Response): Promise<void> {
    try {
      const priceBookId = parseInt(String(req.query.price_book_id), 10);
      const data = await routePricingService.getPriceMatrix(priceBookId);
      sendSuccess(res, data, 'Bảng giá ma trận');
    } catch (err) {
      handleServiceError(res, err, 'Không tải được bảng giá ma trận');
    }
  },

  async listVersions(req: AuthRequest, res: Response): Promise<void> {
    try {
      const configId = parseInt(req.params.configId, 10);
      const data = await routePricingService.listVersions(configId);
      sendSuccess(res, data, 'Lịch sử phiên bản giá');
    } catch (err) {
      handleServiceError(res, err, 'Không tải được lịch sử giá');
    }
  },

  async createPrice(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = await routePricingService.createAbsolutePrice(
        {
          route_group_id: req.body.route_group_id,
          adjustment_period_id: Number(req.body.adjustment_period_id),
          pricing_mode: req.body.pricing_mode,
          pallet_trip_price: Number(req.body.pallet_trip_price),
          tiers: req.body.tiers,
        },
        req.user!.userId,
      );
      sendSuccess(res, data, 'Đã tạo bảng giá gốc', 201);
    } catch (err) {
      handleServiceError(res, err, 'Không tạo được bảng giá');
    }
  },

  async updateAbsolutePrice(req: AuthRequest, res: Response): Promise<void> {
    try {
      const routeGroupId = parseInt(req.params.routeGroupId, 10);
      const data = await routePricingService.updateAbsolutePrice(
        routeGroupId,
        {
          pricing_mode: req.body.pricing_mode,
          pallet_trip_price: Number(req.body.pallet_trip_price),
          tiers: req.body.tiers,
        },
        req.user!.userId,
      );
      sendSuccess(res, data, 'Đã cập nhật bảng giá gốc');
    } catch (err) {
      handleServiceError(res, err, 'Không cập nhật được bảng giá gốc');
    }
  },

  async listPeriods(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = await routePricingService.listAdjustmentPeriods();
      sendSuccess(res, data, 'Danh sách kỳ điều chỉnh');
    } catch (err) {
      handleServiceError(res, err, 'Không tải được kỳ điều chỉnh');
    }
  },

  async createPeriod(req: AuthRequest, res: Response): Promise<void> {
    try {
      const startDate =
        req.body.start_date instanceof Date
          ? req.body.start_date.toISOString().slice(0, 10)
          : String(req.body.start_date).slice(0, 10);
      const data = await routePricingService.createAdjustmentPeriod(
        {
          start_date: startDate,
          percent: Number(req.body.percent),
          note: req.body.note,
        },
        req.user!.userId,
      );
      const msg =
        data.adjusted > 0
          ? `Đã tạo kỳ và điều chỉnh ${data.adjusted} bảng giá`
          : 'Đã tạo kỳ điều chỉnh';
      sendSuccess(res, data, msg, 201);
    } catch (err) {
      handleServiceError(res, err, 'Không tạo được kỳ điều chỉnh');
    }
  },

  async deletePeriod(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const data = await routePricingService.deleteAdjustmentPeriod(id);
      sendSuccess(res, data, 'Đã xóa kỳ điều chỉnh');
    } catch (err) {
      handleServiceError(res, err, 'Không xóa được kỳ điều chỉnh');
    }
  },

  async lookup(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = await routePricingService.lookup({
        supplier_id: parseInt(String(req.query.supplier_id), 10),
        province_code: req.query.province_code as string | undefined,
        ward_code: req.query.ward_code as string | undefined,
        location_text: req.query.location_text as string | undefined,
        note: req.query.note as string | undefined,
        tinh: req.query.tinh as string | undefined,
        phuong: req.query.phuong as string | undefined,
        weight_mt: req.query.weight_mt != null ? Number(req.query.weight_mt) : undefined,
        trips_per_vehicle_day:
          req.query.trips_per_vehicle_day != null && String(req.query.trips_per_vehicle_day) !== ''
            ? Number(req.query.trips_per_vehicle_day)
            : undefined,
        is_pallet: String(req.query.is_pallet) === 'true',
        as_of: req.query.as_of as string | undefined,
      });
      sendSuccess(res, data, 'Lookup giá tuyến');
    } catch (err) {
      handleServiceError(res, err, 'Không lookup được giá');
    }
  },
};
