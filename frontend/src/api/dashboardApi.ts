import axiosClient from './axiosClient';
import type {
  OverviewData,
  VehicleMaintenanceData,
  AccountingData,
  OperationsData,
  FuelDashboardData,
} from '../types/dashboard';

export const dashboardApi = {
  fetchOverview: async (period: 'month' | 'quarter' = 'month'): Promise<OverviewData> => {
    const response = await axiosClient.get<{ data: OverviewData }>('/dashboard/overview', {
      params: { period },
    });
    return response.data.data;
  },

  fetchVehicleMaintenance: async (): Promise<VehicleMaintenanceData> => {
    const response = await axiosClient.get<{ data: VehicleMaintenanceData }>(
      '/dashboard/vehicle-maintenance',
    );
    return response.data.data;
  },

  fetchAccounting: async (): Promise<AccountingData> => {
    const response = await axiosClient.get<{ data: AccountingData }>('/dashboard/accounting');
    return response.data.data;
  },

  fetchOperations: async (params?: {
    date_from?: string;
    date_to?: string;
  }): Promise<OperationsData> => {
    const response = await axiosClient.get<{ data: OperationsData }>('/dashboard/operations', {
      params,
    });
    return response.data.data;
  },

  fetchFuel: async (): Promise<FuelDashboardData> => {
    const response = await axiosClient.get<{ data: FuelDashboardData }>('/dashboard/fuel');
    return response.data.data;
  },
};
