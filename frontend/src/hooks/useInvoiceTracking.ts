import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  invoiceTrackingApi,
  type InvoiceTrackingFilters,
  type InvoiceTrackingStatisticsFilters,
  type CopyDocumentsRequest,
  type ReviewRequest,
} from '../api/invoiceTrackingApi';

export function useInvoiceTracking(filters: InvoiceTrackingFilters) {
  return useQuery({
    queryKey: ['invoice-tracking', 'list', filters],
    queryFn: () => invoiceTrackingApi.list(filters),
  });
}

export function useInvoiceTrackingStatistics(filters: InvoiceTrackingStatisticsFilters) {
  return useQuery({
    queryKey: ['invoice-tracking', 'statistics', filters],
    queryFn: () => invoiceTrackingApi.getStatistics(filters),
  });
}

export function useInvoiceTrackingDetail(id: number | null) {
  return useQuery({
    queryKey: ['invoice-tracking', 'detail', id],
    queryFn: () => invoiceTrackingApi.getById(id!),
    enabled: id !== null && !isNaN(id),
  });
}

export function useInvoiceTrackingHistory(id: number | null) {
  return useQuery({
    queryKey: ['invoice-tracking', 'history', id],
    queryFn: () => invoiceTrackingApi.getHistory(id!),
    enabled: id !== null && !isNaN(id),
  });
}

export function useCopyableTickets(id: number | null) {
  return useQuery({
    queryKey: ['invoice-tracking', 'copyable-tickets', id],
    queryFn: () => invoiceTrackingApi.getCopyableTickets(id!),
    enabled: id !== null && !isNaN(id),
  });
}

export function useUploadDocuments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormData | { files: File[]; driver_note?: string } }) =>
      invoiceTrackingApi.uploadDocuments(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoice-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-tracking', 'detail', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['invoice-tracking', 'history', variables.id] });
    },
  });
}

export function useCopyDocuments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CopyDocumentsRequest }) =>
      invoiceTrackingApi.copyDocuments(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoice-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-tracking', 'detail', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['invoice-tracking', 'history', variables.id] });
    },
  });
}

export function useReviewTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ReviewRequest }) =>
      invoiceTrackingApi.review(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoice-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-tracking', 'detail', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['invoice-tracking', 'history', variables.id] });
    },
  });
}

export function useCreateShareLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => invoiceTrackingApi.createShareLink(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['invoice-tracking', 'detail', id] });
    },
  });
}

export function usePublicTicket(token: string | null | undefined) {
  return useQuery({
    queryKey: ['public-ticket', token],
    queryFn: () => invoiceTrackingApi.getPublicTicket(token!),
    enabled: !!token && token.trim().length >= 10,
    retry: 1,
  });
}
