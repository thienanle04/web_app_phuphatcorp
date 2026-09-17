import axiosClient from './axiosClient';

export interface Vehicle {
  id: number;
  plate_number: string;
  driver_name: string;
  vehicle_type: string;
  status: 'active' | 'deactive';
  oil_change_interval_km: number;
  driver_count?: number;
  created_at: string;
  updated_at: string;
}

export interface VehicleData {
  driver_name: string;
  plate_number: string;
  vehicle_type?: string;
}

export interface VehicleUpdateData {
  driver_name: string;
  vehicle_type?: string;
}

export interface VehicleListResponse {
  vehicles: Vehicle[];
  total: number;
  page: number;
  limit: number;
}

export interface VehicleUploadResult {
  imported: number;
  reactivated: number;
}

export interface VehicleUploadError {
  row: number;
  driver_name: string;
  plate_number: string;
  reason: string;
}

export interface VehicleSummaryRes {
  vehicle: Vehicle;
  inspection: { status: string; expiry_date: string | null; count: number };
  insurance: { status: string; expiry_date: string | null; count: number };
  oil_change: { status: string; last_change_date: string | null; last_odometer: number | null; current_km: number | null; km_since_change: number | null };
  repair: { count: number; total_amount: number };
  fuel: { avg_fuel_rate: number | null; last_odometer: number | null; record_count: number };
}

export const vehicleCatalogApi = {
  fetchAll: async (params?: {
    search?: string;
    status?: string;
    vehicle_type?: string;
    page?: number;
    limit?: number;
  }): Promise<VehicleListResponse> => {
    const response = await axiosClient.get<{ data: VehicleListResponse }>(
      '/vehicles',
      { params },
    );
    return response.data.data;
  },

  upload: async (file: File): Promise<VehicleUploadResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axiosClient.post<{ data: VehicleUploadResult }>(
      '/vehicles/upload',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data.data;
  },

  toggleStatus: async (id: number): Promise<Vehicle> => {
    const response = await axiosClient.patch<{ data: Vehicle }>(`/vehicles/${id}/toggle`);
    return response.data.data;
  },

  create: async (data: VehicleData): Promise<Vehicle> => {
    const response = await axiosClient.post<{ data: Vehicle }>('/vehicles', data);
    return response.data.data;
  },

  update: async (id: number, data: VehicleUpdateData): Promise<Vehicle> => {
    const response = await axiosClient.put<{ data: Vehicle }>(`/vehicles/${id}`, data);
    return response.data.data;
  },

  getSummary: async (id: number): Promise<VehicleSummaryRes> => {
    const response = await axiosClient.get<{ data: VehicleSummaryRes }>(
      `/vehicles/${id}/summary`,
    );
    return response.data.data;
  },
};
