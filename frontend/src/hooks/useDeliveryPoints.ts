import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deliveryPointApi, type DeliveryPointData } from '../api/deliveryPointApi';

const QUERY_KEY = ['delivery-points'];

export function useGetDeliveryPoints(search?: string, page: number = 1, limit: number = 20) {
  return useQuery({
    queryKey: [...QUERY_KEY, { search, page, limit }],
    queryFn: () => deliveryPointApi.fetchAll({ search, page, limit }),
  });
}

export function useCreateDeliveryPoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: DeliveryPointData) => deliveryPointApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useUpdateDeliveryPoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: DeliveryPointData }) =>
      deliveryPointApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useDeleteDeliveryPoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deliveryPointApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
