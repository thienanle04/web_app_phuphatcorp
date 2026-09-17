import axiosClient from './axiosClient';

export interface DocumentFile {
  filename?: string;
  original_filename?: string;
  file_name?: string;
  mime_type: string;
  file_data?: string;
  file_size?: number;
  note?: string;
  uploaded_at?: string;
  source_ticket_id?: number | null;
  source_plate_number?: string | null;
}

export interface CopyableTicket {
  id: number;
  ngay: string;
  loai_tuyen: string;
  loai_xe: string;
  bien_so: string;
  tai_xe: string | null;
  diem_nhan: string;
  invoice_status: string;
  document_count: number;
  documents: DocumentFile[];
}

export interface CopyDocumentsRequest {
  source_ticket_id: number;
  driver_note?: string;
}

export interface UserTicketPermissions {
  can_upload: boolean;
  can_finish: boolean;
  can_request_supplement: boolean;
  current_step_name?: string;
  assignee_description?: string;
}

export interface InvoiceTrackingTicket {
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
  invoice_status: 'created' | 'pending_review' | 'completed' | 'request_supplement';
  driver_id: number | null;
  dispatcher_id: number | null;
  documents: DocumentFile[];
  supplement_note: string | null;
  driver_note: string | null;
  reviewed_at: string | null;
  completed_at: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  user_permissions?: UserTicketPermissions;
}

export interface InvoiceTrackingFilters {
  status?: string[];
  date_from?: string;
  date_to?: string;
  search?: string;
  ghi_chu?: string;
  page?: number;
  limit?: number;
}

export interface InvoiceTrackingPagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface InvoiceTrackingListResponse {
  items: InvoiceTrackingTicket[];
  pagination: InvoiceTrackingPagination;
}

export interface UploadDocumentsRequest {
  files: Omit<DocumentFile, 'uploaded_at'>[];
  driver_note?: string;
}

export interface ReviewRequest {
  action: 'finish' | 'request_supplement';
  supplement_note?: string;
}

export interface InvoiceTrackingHistoryItem {
  id: number;
  action: string;
  action_label: string;
  user_id: number | null;
  username: string | null;
  user_full_name: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface InvoiceTrackingStatisticsFilters {
  date_from?: string;
  date_to?: string;
  bien_so?: string;
  driver_id?: number;
  tai_xe?: string;
  ghi_chu?: string;
}

export interface InvoiceTrackingStatisticsSummary {
  total_tickets: number;
  created_count: number;
  pending_review_count: number;
  request_supplement_count: number;
  completed_count: number;
  completion_rate: number;
}

export interface DriverInvoiceStatistics {
  driver_id: number | null;
  driver_name: string;
  vehicles: string[];
  total_tickets: number;
  created_count: number;
  pending_review_count: number;
  request_supplement_count: number;
  completed_count: number;
  completion_rate: number;
}

export interface InvoiceTrackingStatisticsResult {
  summary: InvoiceTrackingStatisticsSummary;
  by_driver: DriverInvoiceStatistics[];
}

export interface PublicInvoiceTicket {
  id: number;
  ngay: string;
  loai_tuyen: string;
  loai_xe: string;
  xe_type: string;
  bien_so: string;
  tai_xe: string | null;
  diem_nhan: string;
  tan: string | null;
  can: string | null;
  ghi_chu: string | null;
  invoice_status: string;
  documents: DocumentFile[];
  driver_note: string | null;
  reviewed_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export const invoiceTrackingApi = {
  list: async (filters: InvoiceTrackingFilters): Promise<InvoiceTrackingListResponse> => {
    const params = new URLSearchParams();
    if (filters.status && filters.status.length > 0) {
      params.set('status', filters.status.join(','));
    }
    if (filters.date_from) params.set('date_from', filters.date_from);
    if (filters.date_to) params.set('date_to', filters.date_to);
    if (filters.search) params.set('search', filters.search);
    if (filters.ghi_chu) params.set('ghi_chu', filters.ghi_chu);
    if (filters.page) params.set('page', filters.page.toString());
    if (filters.limit) params.set('limit', filters.limit.toString());

    const res = await axiosClient.get<{ success: boolean; data: InvoiceTrackingListResponse }>(
      `/invoice-tracking?${params.toString()}`,
    );
    return res.data.data;
  },

  getStatistics: async (filters: InvoiceTrackingStatisticsFilters): Promise<InvoiceTrackingStatisticsResult> => {
    const params = new URLSearchParams();
    if (filters.date_from) params.set('date_from', filters.date_from);
    if (filters.date_to) params.set('date_to', filters.date_to);
    if (filters.bien_so) params.set('bien_so', filters.bien_so);
    if (filters.driver_id) params.set('driver_id', filters.driver_id.toString());
    if (filters.tai_xe) params.set('tai_xe', filters.tai_xe);
    if (filters.ghi_chu) params.set('ghi_chu', filters.ghi_chu);

    const res = await axiosClient.get<{ success: boolean; data: InvoiceTrackingStatisticsResult }>(
      `/invoice-tracking/statistics?${params.toString()}`,
    );
    return res.data.data;
  },

  getById: async (id: number): Promise<InvoiceTrackingTicket> => {
    const res = await axiosClient.get<{ success: boolean; data: InvoiceTrackingTicket }>(
      `/invoice-tracking/${id}`,
    );
    return res.data.data;
  },

  getHistory: async (id: number): Promise<InvoiceTrackingHistoryItem[]> => {
    const res = await axiosClient.get<{ success: boolean; data: InvoiceTrackingHistoryItem[] }>(
      `/invoice-tracking/${id}/history`,
    );
    return res.data.data;
  },

  uploadDocuments: async (
    id: number,
    data: FormData | { files: File[]; driver_note?: string },
  ): Promise<InvoiceTrackingTicket> => {
    let body: FormData;
    if (data instanceof FormData) {
      body = data;
    } else {
      body = new FormData();
      data.files.forEach((f) => body.append('files', f));
      if (data.driver_note) body.append('driver_note', data.driver_note);
    }
    const res = await axiosClient.post<{ success: boolean; data: InvoiceTrackingTicket }>(
      `/invoice-tracking/${id}/documents`,
      body,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return res.data.data;
  },

  getCopyableTickets: async (id: number): Promise<CopyableTicket[]> => {
    const res = await axiosClient.get<{ success: boolean; data: CopyableTicket[] }>(
      `/invoice-tracking/${id}/copyable-tickets`,
    );
    return res.data.data;
  },

  copyDocuments: async (id: number, data: CopyDocumentsRequest): Promise<InvoiceTrackingTicket> => {
    const res = await axiosClient.post<{ success: boolean; data: InvoiceTrackingTicket }>(
      `/invoice-tracking/${id}/copy-documents`,
      data,
    );
    return res.data.data;
  },

  review: async (id: number, data: ReviewRequest): Promise<InvoiceTrackingTicket> => {
    const res = await axiosClient.put<{ success: boolean; data: InvoiceTrackingTicket }>(
      `/invoice-tracking/${id}/review`,
      data,
    );
    return res.data.data;
  },

  createShareLink: async (id: number): Promise<{ share_token: string }> => {
    const res = await axiosClient.post<{ success: boolean; data: { share_token: string } }>(
      `/invoice-tracking/${id}/share`,
    );
    return res.data.data;
  },

  getPublicTicket: async (token: string): Promise<PublicInvoiceTicket> => {
    const res = await axiosClient.get<{ success: boolean; data: PublicInvoiceTicket }>(
      `/public/invoice-tracking/${token}`,
    );
    return res.data.data;
  },

  /**
   * Helper utility to download a single document file cleanly
   */
  downloadDocumentFile: async (doc: DocumentFile, fallbackName = 'document'): Promise<void> => {
    const fileName = doc.original_filename || doc.file_name || fallbackName;

    if (doc.filename) {
      try {
        const response = await fetch(`/api/invoice-tracking/files/${doc.filename}`);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch {
        window.open(`/api/invoice-tracking/files/${doc.filename}`, '_blank');
      }
    } else if (doc.file_data) {
      const link = document.createElement('a');
      link.href = `data:${doc.mime_type};base64,${doc.file_data}`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  },
};
