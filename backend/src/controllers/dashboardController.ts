import { Request, Response } from 'express';
import dashboardService from '../services/dashboardService';
import { sendSuccess, sendError } from '../utils/response';

export const dashboardController = {
  async overview(req: Request, res: Response): Promise<void> {
    try {
      const period = req.query.period === 'quarter' ? 'quarter' : 'month';
      const data = await dashboardService.getOverview(period);
      sendSuccess(res, data, 'Dashboard tổng quan');
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể tải dữ liệu dashboard', 500, error);
    }
  },

  async vehicleMaintenance(_req: Request, res: Response): Promise<void> {
    try {
      const data = await dashboardService.getVehicleMaintenance();
      sendSuccess(res, data, 'Dashboard bảo trì xe');
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể tải dữ liệu bảo trì xe', 500, error);
    }
  },

  async accounting(_req: Request, res: Response): Promise<void> {
    try {
      const data = await dashboardService.getAccounting();
      sendSuccess(res, data, 'Dashboard kế toán');
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể tải dữ liệu kế toán', 500, error);
    }
  },

  async operations(req: Request, res: Response): Promise<void> {
    try {
      const dateFrom = req.query.date_from as string | undefined;
      const dateTo = req.query.date_to as string | undefined;
      const data = await dashboardService.getOperations(dateFrom, dateTo);
      sendSuccess(res, data, 'Dashboard vận tải');
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể tải dữ liệu vận tải', 500, error);
    }
  },

  async fuel(_req: Request, res: Response): Promise<void> {
    try {
      const data = await dashboardService.getFuel();
      sendSuccess(res, data, 'Dashboard nhiên liệu');
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Không thể tải dữ liệu nhiên liệu', 500, error);
    }
  },
};
