import axiosClient from './axiosClient';

export interface PromoItem {
  id: number;
  code: string;
  product_name: string;
  unit_weight_kg: number;
  status: 'active' | 'deactive';
  created_at: string;
  updated_at: string;
}

export interface PromoItemData {
  code: string;
  product_name: string;
  unit_weight_kg: number;
}

export interface PromoItemListResponse {
  items: PromoItem[];
  total: number;
  page: number;
  limit: number;
}

export const promoItemApi = {
  fetchAll: async (params?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PromoItemListResponse> => {
    const response = await axiosClient.get<{ data: PromoItemListResponse }>(
      '/promo-items',
      { params },
    );
    return response.data.data;
  },

  create: async (data: PromoItemData): Promise<PromoItem> => {
    const response = await axiosClient.post<{ data: PromoItem }>('/promo-items', data);
    return response.data.data;
  },

  update: async (id: number, data: PromoItemData): Promise<PromoItem> => {
    const response = await axiosClient.put<{ data: PromoItem }>(
      `/promo-items/${id}`,
      data,
    );
    return response.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await axiosClient.delete(`/promo-items/${id}`);
  },
};
