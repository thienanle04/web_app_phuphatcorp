import axiosClient from './axiosClient';

export interface DeliveryPoint {
  id: number;
  code: string;
  address: string;
  notes: string | null;
  status: 'active' | 'deactive';
  created_at: string;
  updated_at: string;
}

export interface DeliveryPointData {
  code: string;
  address: string;
  notes?: string | null;
}

export interface DeliveryPointListResponse {
  items: DeliveryPoint[];
  total: number;
  page: number;
  limit: number;
}

export const deliveryPointApi = {
  fetchAll: async (params?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<DeliveryPointListResponse> => {
    const response = await axiosClient.get<{ data: DeliveryPointListResponse }>(
      '/delivery-points',
      { params },
    );
    return response.data.data;
  },

  create: async (data: DeliveryPointData): Promise<DeliveryPoint> => {
    const response = await axiosClient.post<{ data: DeliveryPoint }>('/delivery-points', data);
    return response.data.data;
  },

  update: async (id: number, data: DeliveryPointData): Promise<DeliveryPoint> => {
    const response = await axiosClient.put<{ data: DeliveryPoint }>(
      `/delivery-points/${id}`,
      data,
    );
    return response.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await axiosClient.delete(`/delivery-points/${id}`);
  },
};
