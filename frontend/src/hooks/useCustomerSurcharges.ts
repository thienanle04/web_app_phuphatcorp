import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customerSurchargeApi, type SurchargeListQuery } from '../api/customerSurchargeApi';

export function useCustomerSurcharges(query: SurchargeListQuery) {
  return useQuery({
    queryKey: ['customer-surcharges', query],
    queryFn: () => customerSurchargeApi.list(query),
    placeholderData: keepPreviousData,
  });
}

export function useSurchargeCustomerOptions(enabled: boolean) {
  return useQuery({
    queryKey: ['customer-surcharges', 'options'],
    queryFn: () => customerSurchargeApi.customerOptions(),
    enabled,
  });
}

export function useCustomerSurchargeMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['customer-surcharges'] });
  return {
    create: useMutation({ mutationFn: customerSurchargeApi.create, onSuccess: invalidate }),
    replace: useMutation({
      mutationFn: ({ id, amount, start_date }: { id: number; amount: number; start_date: string }) =>
        customerSurchargeApi.replace(id, { amount, start_date }),
      onSuccess: invalidate,
    }),
    stop: useMutation({
      mutationFn: ({ id, end_date }: { id: number; end_date: string }) => customerSurchargeApi.stop(id, end_date),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: number) => customerSurchargeApi.remove(id),
      onSuccess: invalidate,
    }),
    lookup: useMutation({ mutationFn: customerSurchargeApi.lookup }),
  };
}
