import axiosClient from './axiosClient';

export interface SupplierBrief {
  supplier_code: string;
  name: string;
}

export interface Customer {
  id: number;
  diem_tra_hang: string;
  ten_khach_hang: string;
  tuyen_phuong: string | null;
  tuyen_cu: string | null;
  dia_chi_giao_hang: string | null;
  diem_giao_hang_tinh_phi: string | null;
  boc_xep: boolean;
  supplier_code: string | null;
  supplier: SupplierBrief | null;
  status: 'active' | 'deactive';
  created_at: string;
  updated_at: string;
}

export interface CustomerData {
  diem_tra_hang: string;
  ten_khach_hang: string;
  tuyen_phuong?: string | null;
  tuyen_cu?: string | null;
  dia_chi_giao_hang?: string | null;
  diem_giao_hang_tinh_phi?: string | null;
  boc_xep: boolean;
  supplier_code?: string | null;
}

export interface UploadCustomerRow {
  diem_tra_hang: string;
  ten_khach_hang: string;
  tuyen_phuong?: string | null;
  tuyen_cu?: string | null;
  dia_chi_giao_hang?: string | null;
  diem_giao_hang_tinh_phi?: string | null;
  boc_xep: boolean;
  supplier_code?: string | null;
}

export interface CustomerUploadError {
  row: number;
  diem_tra_hang: string;
  reason: string;
}

export const customersApi = {
  fetchAll: async (): Promise<Customer[]> => {
    const response = await axiosClient.get<{ data: Customer[] }>('/customers');
    return response.data.data;
  },

  create: async (data: CustomerData): Promise<Customer> => {
    const response = await axiosClient.post<{ data: Customer }>('/customers', data);
    return response.data.data;
  },

  update: async (id: number, data: CustomerData): Promise<Customer> => {
    const response = await axiosClient.put<{ data: Customer }>(`/customers/${id}`, data);
    return response.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await axiosClient.delete(`/customers/${id}`);
  },

  upload: async (rows: UploadCustomerRow[]): Promise<{ inserted: number }> => {
    const response = await axiosClient.post<{ data: { inserted: number } }>('/customers/upload', { rows });
    return response.data.data;
  },
};
