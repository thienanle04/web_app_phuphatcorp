import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { driverApi, type CreateDriverData, type UpdateDriverData } from '../api/driverApi';

const QUERY_KEY = ['drivers'];

export function useGetDrivers(params: {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: [...QUERY_KEY, params],
    queryFn: () => driverApi.fetchAll(params),
  });
}

export function useGetAvailableDriverUsers(driverId?: number, enabled = true) {
  return useQuery({
    queryKey: ['available-driver-users', driverId],
    queryFn: () => driverApi.getAvailableUsers(driverId),
    enabled,
  });
}

export function useGetAvailableDriverVehicles(enabled = true) {
  return useQuery({
    queryKey: ['available-driver-vehicles'],
    queryFn: () => driverApi.getAvailableVehicles(),
    enabled,
  });
}

export function useCreateDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDriverData) => driverApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['available-driver-users'] });
    },
  });
}

export function useUpdateDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateDriverData }) =>
      driverApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['available-driver-users'] });
    },
  });
}

export function useToggleDriverStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => driverApi.toggleStatus(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['available-driver-users'] });
    },
  });
}

export function useDeleteDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => driverApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['available-driver-users'] });
    },
  });
}
