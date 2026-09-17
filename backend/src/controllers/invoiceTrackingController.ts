import { Request, Response } from 'express';
import { body, param, query, ValidationChain } from 'express-validator';
import { invoiceTrackingService, InvoiceTrackingError, DocumentFile } from '../services/invoiceTrackingService';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../middleware/auth';

function getCurrentUser(req: AuthRequest) {
  return req.user
    ? { userId: req.user.userId, role: req.user.role, roleId: req.user.roleId }
    : undefined;
}

function handleControllerError(res: Response, err: unknown, defaultMessage: string): void {
  if (err instanceof InvoiceTrackingError) {
    sendError(res, err.message, err.statusCode, err.code);
    return;
  }
  const error = err instanceof Error ? err.message : 'Unknown error';
  console.error(`[InvoiceTrackingController] ${defaultMessage}:`, err);
  sendError(res, defaultMessage, 500, error);
}

export const invoiceTrackingListSchema: ValidationChain[] = [
  query('status')
    .optional()
    .custom((value) => {
      if (typeof value === 'string') {
        const statuses = value.split(',').map((s) => s.trim());
        const allowed = ['created', 'pending_review', 'completed', 'request_supplement'];
        const invalid = statuses.filter((s) => !allowed.includes(s));
        if (invalid.length > 0) {
          throw new Error(`Status không hợp lệ: ${invalid.join(', ')}`);
        }
      }
      return true;
    }),
  query('date_from')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('date_from phải có định dạng YYYY-MM-DD'),
  query('date_to')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('date_to phải có định dạng YYYY-MM-DD'),
  query('search').optional().isString().trim(),
  query('ghi_chu').optional().isString().trim(),
  query('page').optional().isInt({ min: 1 }).withMessage('page phải là số nguyên dương'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit phải từ 1 đến 100'),
];

export const invoiceTrackingDetailSchema: ValidationChain[] = [
  param('id').isInt({ min: 1 }).withMessage('ID không hợp lệ'),
];

export const invoiceTrackingUploadSchema: ValidationChain[] = [
  param('id').isInt({ min: 1 }).withMessage('ID không hợp lệ'),
  body('files')
    .isArray({ min: 1, max: 10 })
    .withMessage('files phải là array từ 1 đến 10 phần tử'),
  body('files.*.file_name').notEmpty().withMessage('file_name là bắt buộc').isString(),
  body('files.*.mime_type')
    .notEmpty()
    .withMessage('mime_type là bắt buộc')
    .isIn(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
    .withMessage('mime_type phải là image/jpeg, image/png, image/webp hoặc application/pdf'),
  body('files.*.file_data').notEmpty().withMessage('file_data là bắt buộc').isString(),
  body('files.*.note').optional().isString(),
  body('driver_note').optional().isString(),
];

export const invoiceTrackingCopySchema: ValidationChain[] = [
  param('id').isInt({ min: 1 }).withMessage('ID không hợp lệ'),
  body('source_ticket_id').isInt({ min: 1 }).withMessage('ID chuyến xe nguồn là bắt buộc'),
  body('driver_note').optional().isString().trim(),
];

export const invoiceTrackingReviewSchema: ValidationChain[] = [
  param('id').isInt({ min: 1 }).withMessage('ID không hợp lệ'),
  body('action')
    .notEmpty()
    .withMessage('action là bắt buộc')
    .isIn(['finish', 'request_supplement'])
    .withMessage("action phải là 'finish' hoặc 'request_supplement'"),
  body('supplement_note')
    .if(body('action').equals('request_supplement'))
    .notEmpty()
    .withMessage('supplement_note là bắt buộc khi action là request_supplement')
    .isLength({ min: 5 })
    .withMessage('supplement_note phải có ít nhất 5 ký tự'),
];

export const invoiceTrackingStatisticsSchema: ValidationChain[] = [
  query('date_from')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('date_from phải có định dạng YYYY-MM-DD'),
  query('date_to')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('date_to phải có định dạng YYYY-MM-DD'),
  query('bien_so').optional().isString().trim(),
  query('driver_id').optional().isInt({ min: 1 }).withMessage('driver_id phải là số nguyên dương'),
  query('tai_xe').optional().isString().trim(),
  query('ghi_chu').optional().isString().trim(),
];

export const invoiceTrackingController = {
  async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      const statusParam = req.query.status as string | undefined;
      const status = statusParam ? statusParam.split(',').map((s) => s.trim()) : undefined;

      const filters = {
        status,
        date_from: req.query.date_from as string | undefined,
        date_to: req.query.date_to as string | undefined,
        search: req.query.search as string | undefined,
        ghi_chu: req.query.ghi_chu as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      };

      const currentUser = getCurrentUser(req);
      const result = await invoiceTrackingService.list(filters, req.dataScope, currentUser);
      sendSuccess(res, { items: result.data, pagination: result.pagination }, 'Danh sách ticket theo dõi hóa đơn');
    } catch (err) {
      handleControllerError(res, err, 'Không thể tải danh sách ticket');
    }
  },

  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const currentUser = getCurrentUser(req);
      const ticket = await invoiceTrackingService.getById(id, req.dataScope, currentUser);
      sendSuccess(res, ticket, 'Chi tiết ticket');
    } catch (err) {
      handleControllerError(res, err, 'Không thể tải chi tiết ticket');
    }
  },

  async uploadDocuments(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const currentUser = getCurrentUser(req);
      const driver_note = (req.body.driver_note as string) || (req.body.note as string) || undefined;

      let filesToUpload: Array<Express.Multer.File | DocumentFile> = [];
      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        filesToUpload = req.files as Express.Multer.File[];
      } else if (req.body.files) {
        if (typeof req.body.files === 'string') {
          try {
            const parsed = JSON.parse(req.body.files);
            if (Array.isArray(parsed)) {
              filesToUpload = parsed as DocumentFile[];
            }
          } catch {
            filesToUpload = [];
          }
        } else if (Array.isArray(req.body.files)) {
          filesToUpload = req.body.files as DocumentFile[];
        }
      }

      if (filesToUpload.length === 0) {
        sendError(res, 'Vui lòng chọn ít nhất 1 tệp chứng từ', 400);
        return;
      }

      const ticket = await invoiceTrackingService.uploadDocuments(id, filesToUpload, driver_note, req.dataScope, currentUser);
      sendSuccess(res, ticket, 'Đã upload chứng từ thành công');
    } catch (err) {
      handleControllerError(res, err, 'Không thể upload chứng từ');
    }
  },

  async getCopyableTickets(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const tickets = await invoiceTrackingService.getCopyableTickets(id, req.dataScope);
      sendSuccess(res, tickets, 'Danh sách chuyến xe có thể sao chép chứng từ');
    } catch (err) {
      handleControllerError(res, err, 'Không thể tải danh sách chuyến xe sao chép');
    }
  },

  async copyDocuments(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const { source_ticket_id, driver_note } = req.body;
      const currentUser = getCurrentUser(req);
      const ticket = await invoiceTrackingService.copyDocuments(
        id,
        parseInt(source_ticket_id, 10),
        driver_note,
        req.dataScope,
        currentUser,
      );
      sendSuccess(res, ticket, 'Đã sao chép chứng từ thành công');
    } catch (err) {
      handleControllerError(res, err, 'Không thể sao chép chứng từ');
    }
  },

  async serveFile(req: Request, res: Response): Promise<void> {
    try {
      const { filename } = req.params;
      const url = await invoiceTrackingService.serveFile(filename);
      res.redirect(302, url);
    } catch (err) {
      handleControllerError(res, err, 'Không thể tải tệp');
    }
  },

  async review(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const { action, supplement_note } = req.body;
      const dispatcherId = req.user!.userId;
      const currentUser = getCurrentUser(req);
      const ticket = await invoiceTrackingService.review(id, action, dispatcherId, supplement_note, currentUser);
      sendSuccess(res, ticket, 'Đã duyệt ticket thành công');
    } catch (err) {
      handleControllerError(res, err, 'Không thể duyệt ticket');
    }
  },

  async getHistory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const history = await invoiceTrackingService.getHistory(id, req.dataScope);
      sendSuccess(res, history, 'Lịch sử thao tác ticket');
    } catch (err) {
      handleControllerError(res, err, 'Không thể tải lịch sử ticket');
    }
  },

  async getStatistics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const filters = {
        date_from: req.query.date_from as string | undefined,
        date_to: req.query.date_to as string | undefined,
        bien_so: req.query.bien_so as string | undefined,
        driver_id: req.query.driver_id ? parseInt(req.query.driver_id as string, 10) : undefined,
        tai_xe: req.query.tai_xe as string | undefined,
        ghi_chu: req.query.ghi_chu as string | undefined,
      };

      const result = await invoiceTrackingService.getStatistics(filters, req.dataScope);
      sendSuccess(res, result, 'Thống kê theo dõi hóa đơn');
    } catch (err) {
      handleControllerError(res, err, 'Không thể tải thống kê theo dõi hóa đơn');
    }
  },

  async createShareLink(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const currentUser = getCurrentUser(req);
      const result = await invoiceTrackingService.getOrCreateShareToken(id, currentUser);
      sendSuccess(res, result, 'Tạo mã chia sẻ thành công');
    } catch (err) {
      handleControllerError(res, err, 'Không thể tạo liên kết chia sẻ');
    }
  },

  async getByShareToken(req: Request, res: Response): Promise<void> {
    try {
      const token = req.params.token as string;
      const ticket = await invoiceTrackingService.getByShareToken(token);
      sendSuccess(res, ticket, 'Thông tin chứng từ chuyến hàng');
    } catch (err) {
      handleControllerError(res, err, 'Không thể tải thông tin chuyến hàng');
    }
  },
};
