import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  dispatchApi,
  type CreateDispatchScheduleRequest,
  type CreateDispatchScheduleBatchItem,
  type UpdateDispatchScheduleRequest,
} from '../api/dispatchApi';

export function useDispatchSchedules(date: string) {
  return useQuery({
    queryKey: ['dispatch-schedules', date],
    queryFn: () => dispatchApi.fetchByDate(date),
    enabled: !!date,
  });
}

export function useCreateDispatchSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDispatchScheduleRequest) => dispatchApi.create(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dispatch-schedules', variables.ngay] });
    },
  });
}

export function useBatchCreateDispatchSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ items, date }: { items: CreateDispatchScheduleBatchItem[]; date: string }) =>
      dispatchApi.batchCreate(items),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dispatch-schedules', variables.date] });
    },
  });
}

export function useUpdateDispatchSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateDispatchScheduleRequest; date: string }) =>
      dispatchApi.update(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dispatch-schedules', variables.date] });
    },
  });
}

export function useDeleteDispatchSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; date: string }) => dispatchApi.remove(id),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dispatch-schedules', variables.date] });
    },
  });
}
