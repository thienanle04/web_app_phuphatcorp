import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bangKeThoApi, type BangKeBatch } from '../api/bangKeThoApi';

const BANG_KE_KEY = 'bang-ke-tho';

export function useBangKeThoBatches(page: number, q: string) {
  return useQuery({
    queryKey: [BANG_KE_KEY, page, q],
    queryFn: () => bangKeThoApi.listBatches({ page, limit: 20, q: q || undefined }),
    placeholderData: (prev) => prev,
  });
}

export function useUploadBangKeTho() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, overwrite }: { file: File; overwrite: boolean }) =>
      bangKeThoApi.uploadBatch(file, overwrite),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BANG_KE_KEY] });
    },
  });
}

export function useDeleteBangKeTho() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bangKeThoApi.deleteBatch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BANG_KE_KEY] });
    },
  });
}

export type { BangKeBatch };
