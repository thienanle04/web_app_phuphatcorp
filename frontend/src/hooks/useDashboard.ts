import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboardApi';

const QUERY_KEY = ['dashboard'];
const STALE_TIME = 60_000;

export function useOverview(period: 'month' | 'quarter' = 'month', enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEY, 'overview', period],
    queryFn: () => dashboardApi.fetchOverview(period),
    staleTime: STALE_TIME,
    enabled,
  });
}

export function useVehicleMaintenanceDashboard(enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEY, 'vehicle-maintenance'],
    queryFn: () => dashboardApi.fetchVehicleMaintenance(),
    staleTime: STALE_TIME,
    enabled,
  });
}

export function useAccountingDashboard(enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEY, 'accounting'],
    queryFn: () => dashboardApi.fetchAccounting(),
    staleTime: STALE_TIME,
    enabled,
  });
}

export function useOperationsDashboard(
  params?: { date_from?: string; date_to?: string },
  enabled = true,
) {
  return useQuery({
    queryKey: [...QUERY_KEY, 'operations', params],
    queryFn: () => dashboardApi.fetchOperations(params),
    staleTime: STALE_TIME,
    enabled,
  });
}

export function useFuelDashboard(enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEY, 'fuel'],
    queryFn: () => dashboardApi.fetchFuel(),
    staleTime: STALE_TIME,
    enabled,
  });
}
