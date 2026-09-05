import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { promoItemApi, type PromoItemData } from '../api/promoItemApi';

const QUERY_KEY = ['promo-items'];

export function useGetPromoItems(search?: string, page: number = 1, limit: number = 20) {
  return useQuery({
    queryKey: [...QUERY_KEY, { search, page, limit }],
    queryFn: () => promoItemApi.fetchAll({ search, page, limit }),
  });
}

export function useCreatePromoItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PromoItemData) => promoItemApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useUpdatePromoItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: PromoItemData }) =>
      promoItemApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useDeletePromoItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => promoItemApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
