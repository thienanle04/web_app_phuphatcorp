import { Router } from 'express';
import { param } from 'express-validator';
import { invoiceTrackingController } from '../controllers/invoiceTrackingController';
import { validate } from '../middleware/validate';

const router = Router();

export const shareTokenParamSchema = [
  param('token')
    .isString()
    .trim()
    .isLength({ min: 10, max: 64 })
    .withMessage('Mã chia sẻ không hợp lệ'),
];

router.get(
  '/invoice-tracking/:token',
  ...validate(shareTokenParamSchema),
  invoiceTrackingController.getByShareToken,
);

export default router;
