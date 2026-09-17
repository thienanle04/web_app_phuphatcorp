import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import {
  bangKeThoController,
  listBangKeSchema,
  batchIdSchema,
  houseFileSchema,
} from '../controllers/bangKeThoController';
import { validate } from '../middleware/validate';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { sendError } from '../utils/response';
import { MAX_FILE_BYTES } from '../constants/bangKeTho';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (_req, file, cb) => {
    const okType =
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.originalname.toLowerCase().endsWith('.xlsx');
    if (okType) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file .xlsx'));
    }
  },
});

function uploadExcel(req: Request, res: Response, next: NextFunction): void {
  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      sendError(res, 'File quá lớn (tối đa 10 MB)', 400);
      return;
    }
    if (err instanceof Error) {
      sendError(res, err.message, 400);
      return;
    }
    next();
  });
}

router.use(authenticateToken);

router.get(
  '/batches',
  requirePermission('accounting_data.view'),
  ...validate(listBangKeSchema),
  bangKeThoController.listBatches,
);

router.post(
  '/batches',
  requirePermission('accounting_data.manage'),
  uploadExcel,
  bangKeThoController.createBatch,
);

router.get(
  '/batches/:id/files/input',
  requirePermission('accounting_data.view'),
  ...validate(batchIdSchema),
  bangKeThoController.downloadInput,
);

router.get(
  '/batches/:id/files/:houseCode',
  requirePermission('accounting_data.view'),
  ...validate(houseFileSchema),
  bangKeThoController.downloadOutput,
);

router.delete(
  '/batches/:id',
  requirePermission('accounting_data.manage'),
  ...validate(batchIdSchema),
  bangKeThoController.deleteBatch,
);

export default router;
