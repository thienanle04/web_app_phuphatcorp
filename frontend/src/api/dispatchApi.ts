import axiosClient from './axiosClient';

export interface DispatchSchedule {
  id: number;
  ngay: string;
  loai_tuyen: 'Tuyến cố định' | 'Tuyến ngoài';
  loai_xe: 'Xe lớn' | 'Xe nhỏ';
  xe_type: 'Xe nhà' | 'Xe ngoài';
  bien_so: string;
  tai_xe: string | null;
  vehicle_id: number | null;
  diem_nhan: string;
  tan: string | null;
  can: string | null;
  ghi_chu: string | null;
  created_at: string;
}

export interface DispatchScheduleListResponse {
  xe_nho: DispatchSchedule[];
  xe_lon: DispatchSchedule[];
  tuyen_ngoai: DispatchSchedule[];
}

export interface CreateDispatchScheduleRequest {
  ngay: string;
  loai_tuyen: 'Tuyến cố định' | 'Tuyến ngoài';
  loai_xe: 'Xe lớn' | 'Xe nhỏ';
  xe_type: 'Xe nhà' | 'Xe ngoài';
  diem_nhan: string;
  tan?: string | null;
  can?: string | null;
  ghi_chu?: string | null;
}

export interface CreateDispatchScheduleBatchItem {
  ngay: string;
  loai_tuyen: 'Tuyến cố định' | 'Tuyến ngoài';
  loai_xe: 'Xe lớn' | 'Xe nhỏ';
  bien_so: string;
  tai_xe?: string | null;
  vehicle_id?: number | null;
  driver_id?: number | null;
  diem_nhan: string;
  tan?: string | null;
  can?: string | null;
  ghi_chu?: string | null;
}

export interface UpdateDispatchScheduleRequest {
  diem_nhan: string;
  tan?: string | null;
  can?: string | null;
  ghi_chu?: string | null;
}

export const dispatchApi = {
  fetchByDate: async (date: string): Promise<DispatchScheduleListResponse> => {
    const res = await axiosClient.get<{ success: boolean; data: DispatchScheduleListResponse }>(
      `/dispatch-schedules?date=${date}`,
    );
    return res.data.data;
  },

  create: async (data: CreateDispatchScheduleRequest): Promise<DispatchSchedule> => {
    const res = await axiosClient.post<{ success: boolean; data: DispatchSchedule }>(
      '/dispatch-schedules',
      data,
    );
    return res.data.data;
  },

  batchCreate: async (items: CreateDispatchScheduleBatchItem[]): Promise<DispatchSchedule[]> => {
    const res = await axiosClient.post<{ success: boolean; data: DispatchSchedule[] }>(
      '/dispatch-schedules/batch',
      { items },
    );
    return res.data.data;
  },

  update: async (id: number, data: UpdateDispatchScheduleRequest): Promise<DispatchSchedule> => {
    const res = await axiosClient.put<{ success: boolean; data: DispatchSchedule }>(
      `/dispatch-schedules/${id}`,
      data,
    );
    return res.data.data;
  },

  remove: async (id: number): Promise<void> => {
    await axiosClient.delete(`/dispatch-schedules/${id}`);
  },
};
