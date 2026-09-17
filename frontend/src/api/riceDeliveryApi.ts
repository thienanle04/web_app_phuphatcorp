/**
 * riceDeliveryApi.ts
 * Fetch driver invoices để làm master data cho tính năng xử lý data gạo.
 * Tái dụng API driver-invoices đã có, fetch ALL (không phân trang)
 * trong 1 date range để build MasterPlateMap.
 */

import axiosClient from './axiosClient';

export interface SchedulePlate {
  ngay: string;      // YYYY-MM-DD
  so_xe: string | null;
}

export interface FetchPlatesResult {
  schedules: SchedulePlate[];
  totalFetched: number;
}

export const riceDeliveryApi = {
  /**
   * Lấy toàn bộ biển số + ngày trong khoảng date range từ driver_invoices.
   * Pagination loop để lấy hết data.
   */
  fetchPlatesForRange: async (
    fromDate: string,
    toDate: string
  ): Promise<FetchPlatesResult> => {
    const params = new URLSearchParams({
      ngay_from: fromDate,
      ngay_to: toDate,
      limit: '100',
      page: '1',
    });

    const response = await axiosClient.get<{
      data: {
        data: Array<{ ngay: string; so_xe: string }>;
        pagination: { total: number; totalPages: number };
      };
    }>(`/driver-invoices?${params.toString()}`);

    const { data: invoices, pagination } = response.data.data;

    let allSchedules: SchedulePlate[] = invoices.map((inv) => ({
      ngay: inv.ngay,
      so_xe: inv.so_xe,
    }));

    if (pagination.totalPages > 1) {
      for (let page = 2; page <= pagination.totalPages; page++) {
        const p2 = new URLSearchParams({
          ngay_from: fromDate,
          ngay_to: toDate,
          limit: '100',
          page: String(page),
        });
        const r2 = await axiosClient.get<{
          data: {
            data: Array<{ ngay: string; so_xe: string }>;
          };
        }>(`/driver-invoices?${p2.toString()}`);
        allSchedules = allSchedules.concat(
          r2.data.data.data.map((inv) => ({ ngay: inv.ngay, so_xe: inv.so_xe }))
        );
      }
    }

    return {
      schedules: allSchedules,
      totalFetched: allSchedules.length,
    };
  },
};
