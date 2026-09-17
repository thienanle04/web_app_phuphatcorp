import axiosClient from './axiosClient';

export interface AssignedVehicle {
  id: number;
  plate_number: string;
  driver_name: string;
  vehicle_type: string;
}

export interface Driver {
  id: number;
  user_id: number;
  full_name: string;
  username: string;
  email: string;
  status: 'active' | 'deactive';
  notes: string | null;
  vehicles: AssignedVehicle[];
  created_at: string;
  updated_at: string;
}

export interface DriverListResponse {
  drivers: Driver[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateDriverData {
  user_id: number;
  vehicle_ids: number[];
  notes?: string | null;
}

export interface UpdateDriverData {
  vehicle_ids: number[];
  notes?: string | null;
}

export interface AvailableUser {
  id: number;
  username: string;
  full_name: string;
  email: string;
}

export interface AvailableVehicle {
  id: number;
  plate_number: string;
  driver_name: string;
  vehicle_type: string;
}

export interface VehicleDriver {
  id: number;
  user_id: number;
  full_name: string;
  username: string;
}

export const driverApi = {
  fetchAll: async (params?: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<DriverListResponse> => {
    const response = await axiosClient.get<{ data: DriverListResponse }>('/drivers', { params });
    return response.data.data;
  },

  getAvailableUsers: async (driverId?: number): Promise<AvailableUser[]> => {
    const response = await axiosClient.get<{ data: AvailableUser[] }>('/drivers/available-users', {
      params: { driverId },
    });
    return response.data.data;
  },

  getAvailableVehicles: async (): Promise<AvailableVehicle[]> => {
    const response = await axiosClient.get<{ data: AvailableVehicle[] }>('/drivers/available-vehicles');
    return response.data.data;
  },

  getDriversByVehicle: async (vehicleId: number): Promise<VehicleDriver[]> => {
    const response = await axiosClient.get<{ data: VehicleDriver[] }>(`/drivers/by-vehicle/${vehicleId}`);
    return response.data.data;
  },

  create: async (data: CreateDriverData): Promise<Driver> => {
    const response = await axiosClient.post<{ data: Driver }>('/drivers', data);
    return response.data.data;
  },

  update: async (id: number, data: UpdateDriverData): Promise<Driver> => {
    const response = await axiosClient.put<{ data: Driver }>(`/drivers/${id}`, data);
    return response.data.data;
  },

  toggleStatus: async (id: number): Promise<Driver> => {
    const response = await axiosClient.patch<{ data: Driver }>(`/drivers/${id}/toggle`);
    return response.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await axiosClient.delete(`/drivers/${id}`);
  },
};
