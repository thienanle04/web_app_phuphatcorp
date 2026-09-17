import axiosClient from './axiosClient';

export type BangKeHouseCode = 'nd_mcc' | 'clv' | 'calofic';
export type BangKeHouseStatus = 'pending' | 'ready' | 'failed';

export interface BangKeHouse {
  house_code: BangKeHouseCode;
  status: BangKeHouseStatus;
  download_filename: string;
  error_message: string | null;
}

export interface BangKeBatch {
  id: string;
  original_filename: string;
  filename_key: string;
  input_size_bytes: number;
  uploaded_by_name: string;
  uploaded_at: string;
  houses: BangKeHouse[];
}

export interface BangKeDuplicate {
  code: 'BANG_KE_DUPLICATE';
  batch_id: string;
  original_filename: string;
}

export interface PaginatedBangKe {
  data: BangKeBatch[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function filenameFromDisposition(header: string | undefined, fallback: string): string {
  if (!header) return fallback;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      return fallback;
    }
  }
  const plain = /filename="([^"]+)"/i.exec(header);
  return plain?.[1] ?? fallback;
}

export const bangKeThoApi = {
  listBatches: async (params: {
    page: number;
    limit?: number;
    q?: string;
  }): Promise<PaginatedBangKe> => {
    const search = new URLSearchParams();
    search.set('page', String(params.page));
    search.set('limit', String(params.limit ?? 20));
    if (params.q) search.set('q', params.q);
    const response = await axiosClient.get<{ data: PaginatedBangKe }>(
      `/bang-ke-tho/batches?${search.toString()}`,
    );
    return response.data.data;
  },

  uploadBatch: async (file: File, overwrite = false): Promise<BangKeBatch> => {
    const formData = new FormData();
    formData.append('file', file);
    const qs = overwrite ? '?overwrite=true' : '';
    const response = await axiosClient.post<{ data: BangKeBatch }>(
      `/bang-ke-tho/batches${qs}`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data.data;
  },

  deleteBatch: async (id: string): Promise<{ id: string }> => {
    const response = await axiosClient.delete<{ data: { id: string } }>(
      `/bang-ke-tho/batches/${id}`,
    );
    return response.data.data;
  },

  downloadInput: async (id: string, fallbackName: string): Promise<void> => {
    const response = await axiosClient.get(`/bang-ke-tho/batches/${id}/files/input`, {
      responseType: 'blob',
    });
    const header = response.headers['content-disposition'] as string | undefined;
    const filename = filenameFromDisposition(header, fallbackName);
    const url = window.URL.createObjectURL(response.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
};
