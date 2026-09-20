import { pipeline } from 'stream/promises';
import { query, param, ValidationChain } from 'express-validator';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { bangKeThoService, BangKeError } from '../services/bangKeTho';
import { sendSuccess, sendError } from '../utils/response';
import { auditService } from '../services/auditService';

export const listBangKeSchema: ValidationChain[] = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be >= 1'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
  query('q').optional().isString(),
];

export const batchIdSchema: ValidationChain[] = [
  param('id').isUUID().withMessage('ID không hợp lệ'),
];

export const houseFileSchema: ValidationChain[] = [
  param('id').isUUID().withMessage('ID không hợp lệ'),
  param('houseCode').isString().notEmpty().withMessage('Mã nhà là bắt buộc'),
];

function isBangKeError(err: unknown): err is BangKeError {
  return err instanceof BangKeError;
}

function handleServiceError(res: Response, err: unknown, fallback: string): void {
  if (isBangKeError(err)) {
    sendError(res, err.message, err.statusCode, err.code, err.data);
    return;
  }
  const message = err instanceof Error ? err.message : fallback;
  sendError(res, fallback, 500, message);
}

function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export const bangKeThoController = {
  async createBatch(req: AuthRequest, res: Response): Promise<void> {
    const file = req.file;
    if (!file) {
      sendError(res, 'Vui lòng chọn file để upload', 400);
      return;
    }
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    const overwrite =
      req.query.overwrite === 'true' || req.query.overwrite === '1';
    try {
      const result = await bangKeThoService.createBatch({
        buffer: file.buffer,
        originalFilename: file.originalname || 'unknown.xlsx',
        mimetype: file.mimetype,
        userId,
        overwrite,
      });
      sendSuccess(res, result, overwrite ? 'Đã ghi đè file' : 'Đã lưu file bảng kê thô');
      auditService.logAudit({
        userId,
        username: req.user!.email,
        action: overwrite ? 'UPDATE' : 'CREATE',
        entityType: 'bang_ke_tho',
        entityLabel: result.original_filename,
        ipAddress: req.ip,
        details: { batchId: result.id, overwrite },
      });
    } catch (err) {
      handleServiceError(res, err, 'Không lưu được file. Thử lại.');
    }
  },

  async listBatches(req: AuthRequest, res: Response): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const q = typeof req.query.q === 'string' ? req.query.q : undefined;
      const result = await bangKeThoService.listBatches({ page, limit, q });
      sendSuccess(res, result, 'OK');
    } catch (err) {
      handleServiceError(res, err, 'Không tải được danh sách.');
    }
  },

  async deleteBatch(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await bangKeThoService.deleteBatch(req.params.id);
      sendSuccess(res, result, 'Đã xóa đợt');
      if (req.user) {
        auditService.logAudit({
          userId: req.user.userId,
          username: req.user.email,
          action: 'DELETE',
          entityType: 'bang_ke_tho',
          entityLabel: req.params.id,
          ipAddress: req.ip,
        });
      }
    } catch (err) {
      handleServiceError(res, err, 'Không xóa được đợt');
    }
  },

  async downloadInput(req: AuthRequest, res: Response): Promise<void> {
    try {
      const file = await bangKeThoService.getInputStream(req.params.id);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', contentDisposition(file.downloadFilename));
      if (file.stat.size) {
        res.setHeader('Content-Length', String(file.stat.size));
      }
      await pipeline(file.stream, res);
    } catch (err) {
      if (res.headersSent) return;
      handleServiceError(res, err, 'Không tìm thấy file');
    }
  },

  async downloadOutput(req: AuthRequest, res: Response): Promise<void> {
    try {
      const file = await bangKeThoService.getOutputStream(
        req.params.id,
        req.params.houseCode,
      );
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', contentDisposition(file.downloadFilename));
      if (file.stat.size) {
        res.setHeader('Content-Length', String(file.stat.size));
      }
      await pipeline(file.stream, res);
    } catch (err) {
      if (res.headersSent) return;
      handleServiceError(res, err, 'Không tìm thấy file');
    }
  },

  async processNdMcc(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    const batchId = req.params.id;
    try {
      const result = await bangKeThoService.processNdMcc(batchId, userId);
      sendSuccess(res, result, 'Xử lý bảng kê thô ND-MCC thành công');
      auditService.logAudit({
        userId,
        username: req.user!.email,
        action: 'UPDATE',
        entityType: 'bang_ke_tho_nd_mcc',
        entityLabel: result.download_filename,
        ipAddress: req.ip,
        details: { batchId, stats: result.stats },
      });
    } catch (err) {
      handleServiceError(res, err, 'Xử lý bảng kê ND-MCC thất bại');
    }
  },
};
