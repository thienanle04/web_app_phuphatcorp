import { Router } from 'express';
import multer from 'multer';
import { param } from 'express-validator';
import {
  invoiceTrackingController,
  invoiceTrackingListSchema,
  invoiceTrackingDetailSchema,
  invoiceTrackingCopySchema,
  invoiceTrackingReviewSchema,
  invoiceTrackingStatisticsSchema,
} from '../controllers/invoiceTrackingController';
import { validate } from '../middleware/validate';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { resolveDataScope } from '../middleware/dataScope';

const router = Router();

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

export const invoiceTrackingFileParamSchema = [
  param('filename')
    .isString()
    .trim()
    .matches(/^[a-zA-Z0-9_\-\.]+$/)
    .withMessage('Tên tệp không hợp lệ'),
];

// Public route to serve MinIO files (no auth required — used by <img>/<a> tags & public view)
router.get('/files/:filename', ...validate(invoiceTrackingFileParamSchema), invoiceTrackingController.serveFile);

router.use(authenticateToken);
router.use(resolveDataScope('invoice_tracking'));

router.get('/', requirePermission('invoice_tracking.view'), ...validate(invoiceTrackingListSchema), invoiceTrackingController.list);
router.get('/statistics', requirePermission('invoice_tracking.view'), ...validate(invoiceTrackingStatisticsSchema), invoiceTrackingController.getStatistics);
router.get('/:id', requirePermission('invoice_tracking.view'), ...validate(invoiceTrackingDetailSchema), invoiceTrackingController.getById);
router.get('/:id/history', requirePermission('invoice_tracking.view'), ...validate(invoiceTrackingDetailSchema), invoiceTrackingController.getHistory);
router.get('/:id/copyable-tickets', requirePermission('invoice_tracking.view'), ...validate(invoiceTrackingDetailSchema), invoiceTrackingController.getCopyableTickets);
router.post('/:id/share', requirePermission('invoice_tracking.view'), ...validate(invoiceTrackingDetailSchema), invoiceTrackingController.createShareLink);
router.post('/:id/copy-documents', requirePermission('invoice_tracking.view'), ...validate(invoiceTrackingCopySchema), invoiceTrackingController.copyDocuments);
router.post('/:id/documents', requirePermission('invoice_tracking.view'), imageUpload.array('files', 10), invoiceTrackingController.uploadDocuments);
router.put('/:id/review', requirePermission('invoice_tracking.manage'), ...validate(invoiceTrackingReviewSchema), invoiceTrackingController.review);

export default router;
