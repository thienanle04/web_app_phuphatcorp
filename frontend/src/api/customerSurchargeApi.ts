import axiosClient from './axiosClient';

export type FeeType = 'boc_xep' | 'phu_phi_giao_hang' | 'chuyen_tai';
export type SurchargeZone = 'noi_thanh' | 'tinh';
export type VehicleClass = 'le_2_5' | 'gt_8_16' | 'gt_16_23' | 'pallet';
export type PricingUnit = 'tan' | 'chuyen';

export interface CustomerSurchargeRule {
  id: number;
  ten_khach_hang: string;
  customer_id: number | null;
  fee_type: FeeType;
  zone: SurchargeZone | null;
  vehicle_class: VehicleClass | null;
  amount: number;
  pricing_unit: PricingUnit;
  start_date: string;
  end_date: string | null;
  diem_tra_hang: string | null;
  dia_chi_giao_hang: string | null;
  supplier_name: string | null;
  supplier_code: string | null;
  customer_status: string | null;
  has_closed_prior?: boolean;
}

export interface SurchargeListResult {
  items: CustomerSurchargeRule[];
  page: number;
  page_size: number;
  total: number;
}

export interface CustomerOptionPoint {
  id: number;
  ten_khach_hang: string;
  diem_tra_hang: string;
  dia_chi_giao_hang: string;
  supplier_name: string | null;
  supplier_code: string | null;
}

export interface FeeHit {
  rate: number | null;
  unit: PricingUnit | null;
  reason: 'MATCHED' | 'NO_RULE' | 'AMBIGUOUS';
  scope: 'diem' | 'dai_ly' | null;
}

export interface SurchargeLookupResult {
  point_status: 'MATCHED' | 'NO_POINT' | 'AMBIGUOUS';
  point: {
    diem_tra_hang: string;
    tuyen_phuong: string | null;
    diem_giao_hang_tinh_phi: string | null;
    supplier_name: string | null;
    supplier_code: string | null;
  } | null;
  fees: Record<FeeType, FeeHit>;
}

export interface SurchargeNameFailure {
  ten_khach_hang: string;
  code: string;
}

export interface SurchargeCreateBody {
  ten_khach_hang: string;
  ten_khach_hangs?: string[];
  customer_id?: number | null;
  fee_type: FeeType;
  zone?: SurchargeZone | null;
  vehicle_class?: VehicleClass | null;
  amount: number;
  start_date: string;
}

export interface SurchargeListQuery {
  ten_khach_hang?: string;
  fee_type?: string;
  zone?: string;
  vehicle_class?: string;
  status?: string;
  page?: number;
  page_size?: number;
}

export const customerSurchargeApi = {
  list: async (query: SurchargeListQuery): Promise<SurchargeListResult> => {
    const res = await axiosClient.get<{ data: SurchargeListResult }>('/route-pricing/surcharges', { params: query });
    return res.data.data;
  },
  customerOptions: async (): Promise<{ names: string[]; points: CustomerOptionPoint[] }> => {
    const res = await axiosClient.get<{ data: { names: string[]; points: CustomerOptionPoint[] } }>(
      '/route-pricing/surcharges/customer-options',
    );
    return res.data.data;
  },
  create: async (body: SurchargeCreateBody): Promise<{ items: CustomerSurchargeRule[] }> => {
    const res = await axiosClient.post<{ data: { items: CustomerSurchargeRule[] } }>('/route-pricing/surcharges', body);
    return res.data.data;
  },
  replace: async (id: number, body: { amount: number; start_date: string }): Promise<CustomerSurchargeRule> => {
    const res = await axiosClient.post<{ data: CustomerSurchargeRule }>(`/route-pricing/surcharges/${id}/replace`, body);
    return res.data.data;
  },
  stop: async (id: number, end_date: string): Promise<CustomerSurchargeRule> => {
    const res = await axiosClient.post<{ data: CustomerSurchargeRule }>(`/route-pricing/surcharges/${id}/stop`, { end_date });
    return res.data.data;
  },
  remove: async (id: number): Promise<void> => {
    await axiosClient.delete(`/route-pricing/surcharges/${id}`);
  },
  lookup: async (body: {
    ten_khach_hang: string;
    dia_chi_giao_hang: string;
    zone: SurchargeZone;
    vehicle_class: VehicleClass;
    on_date: string;
    supplier_code?: string;
  }): Promise<SurchargeLookupResult> => {
    const res = await axiosClient.post<{ data: SurchargeLookupResult }>('/route-pricing/surcharges/lookup', body);
    return res.data.data;
  },
};
