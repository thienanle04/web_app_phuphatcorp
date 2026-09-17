import { invoiceTrackingService, InvoiceTrackingError } from '../services/invoiceTrackingService';
import { workflowService } from '../services/workflowService';
import { pool } from './__mocks__/database';

const mockPool = pool as jest.Mocked<typeof pool>;

beforeEach(() => {
  jest.clearAllMocks();
});

const mockTicketRow = {
  id: 10,
  ngay: '2026-09-13',
  loai_tuyen: 'Tuyến cố định',
  loai_xe: 'Xe lớn',
  xe_type: 'Xe nhà',
  bien_so: '51H99999',
  tai_xe: 'Lê Văn B',
  vehicle_id: 1,
  diem_nhan: 'Kho Thủ Đức',
  tan: '10',
  can: null,
  ghi_chu: 'Giao sáng',
  invoice_status: 'created',
  driver_id: 85,
  dispatcher_id: null,
  documents: [],
  supplement_note: null,
  driver_note: null,
  reviewed_at: null,
  completed_at: null,
  share_token: null,
  created_by: 1,
  created_at: '2026-09-13T07:00:00Z',
  updated_at: '2026-09-13T07:00:00Z',
};

describe('invoiceTrackingService.serveFile', () => {
  it('throws error for path traversal or invalid characters', async () => {
    await expect(invoiceTrackingService.serveFile('../secret.txt')).rejects.toThrow(InvoiceTrackingError);
    await expect(invoiceTrackingService.serveFile('folder/file.jpg')).rejects.toThrow(InvoiceTrackingError);
    await expect(invoiceTrackingService.serveFile('file name with space.jpg')).rejects.toThrow(InvoiceTrackingError);
    await expect(invoiceTrackingService.serveFile('')).rejects.toThrow(InvoiceTrackingError);
  });
});

describe('invoiceTrackingService.getCopyableTickets', () => {
  it('returns copyable tickets from same date and excludes current ticket', async () => {
    // 1. getById target ticket
    mockPool.query.mockResolvedValueOnce({ rows: [mockTicketRow] } as never);

    // 2. query other trips on same date with documents
    const mockOtherTrip = {
      ...mockTicketRow,
      id: 11,
      bien_so: '50H12345',
      invoice_status: 'pending_review',
      documents: [
        {
          filename: '123456.jpg',
          original_filename: 'hoa_don.jpg',
          mime_type: 'image/jpeg',
          file_size: 1024,
        },
      ],
    };
    mockPool.query.mockResolvedValueOnce({ rows: [mockOtherTrip] } as never);

    const result = await invoiceTrackingService.getCopyableTickets(10);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(11);
    expect(result[0].bien_so).toBe('50H12345');
    expect(result[0].document_count).toBe(1);
    expect(result[0].documents[0].source_plate_number).toBe('50H12345');
  });
});

describe('invoiceTrackingService.copyDocuments', () => {
  it('rejects copy from same ticket ID', async () => {
    // 1. getById target
    mockPool.query.mockResolvedValueOnce({ rows: [mockTicketRow] } as never);

    await expect(invoiceTrackingService.copyDocuments(10, 10)).rejects.toThrow('Không thể sao chép từ chính chuyến xe này');
  });

  it('rejects copy if source ticket is from a different date', async () => {
    // 1. getById target (date 2026-09-13)
    mockPool.query.mockResolvedValueOnce({ rows: [mockTicketRow] } as never);
    // 2. getById source (date 2026-09-12)
    mockPool.query.mockResolvedValueOnce({ rows: [{ ...mockTicketRow, id: 11, ngay: '2026-09-12' }] } as never);

    await expect(invoiceTrackingService.copyDocuments(10, 11)).rejects.toThrow('Chỉ có thể sao chép chứng từ từ chuyến xe cùng ngày');
  });

  it('copies document references successfully and updates status to pending_review', async () => {
    jest.spyOn(workflowService, 'getNextStatus').mockResolvedValueOnce('pending_review');

    // 1. getById target
    mockPool.query.mockResolvedValueOnce({ rows: [mockTicketRow] } as never);
    // 2. getById source with docs
    const sourceDoc = {
      filename: 'source_doc.jpg',
      original_filename: 'hoadon.jpg',
      mime_type: 'image/jpeg',
      file_size: 2048,
    };
    mockPool.query.mockResolvedValueOnce({
      rows: [{ ...mockTicketRow, id: 11, bien_so: '50H11111', documents: [sourceDoc] }],
    } as never);

    // 3. update query
    const updatedRow = {
      ...mockTicketRow,
      invoice_status: 'pending_review',
      documents: [{ ...sourceDoc, source_ticket_id: 11, source_plate_number: '50H11111' }],
    };
    mockPool.query.mockResolvedValueOnce({ rows: [updatedRow] } as never);

    const res = await invoiceTrackingService.copyDocuments(10, 11, 'Đi chung xe');
    expect(res.invoice_status).toBe('pending_review');
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE dispatch_schedules'),
      expect.arrayContaining([expect.stringContaining('source_doc.jpg')]),
    );
  });
});

describe('invoiceTrackingService.getStatistics', () => {
  it('calculates completion rates and aggregates driver stats accurately', async () => {
    const mockDriverRows = [
      {
        driver_id: 85,
        driver_name: 'Lê Văn B',
        vehicles: ['51H99999'],
        total_tickets: 10,
        created_count: 2,
        pending_review_count: 3,
        request_supplement_count: 1,
        completed_count: 4,
      },
      {
        driver_id: 86,
        driver_name: 'Trần Văn C',
        vehicles: ['50H12345'],
        total_tickets: 5,
        created_count: 0,
        pending_review_count: 0,
        request_supplement_count: 0,
        completed_count: 5,
      },
    ];

    mockPool.query.mockResolvedValueOnce({ rows: mockDriverRows } as never);

    const stats = await invoiceTrackingService.getStatistics({});

    expect(stats.summary.total_tickets).toBe(15);
    expect(stats.summary.completed_count).toBe(9);
    expect(stats.summary.completion_rate).toBe(60); // (9/15) * 100 = 60%
    expect(stats.by_driver).toHaveLength(2);
    expect(stats.by_driver[0].completion_rate).toBe(40); // (4/10) * 100 = 40%
    expect(stats.by_driver[1].completion_rate).toBe(100);
  });
});

describe('invoiceTrackingService.getOrCreateShareToken & getByShareToken', () => {
  it('generates a new token if not present', async () => {
    // 1. getById ticket without share_token
    mockPool.query.mockResolvedValueOnce({ rows: [mockTicketRow] } as never);
    // 2. update query
    mockPool.query.mockResolvedValueOnce({ rows: [] } as never);

    const res = await invoiceTrackingService.getOrCreateShareToken(10);
    expect(res.share_token).toBeDefined();
    expect(res.share_token.length).toBeGreaterThanOrEqual(16);
  });

  it('retrieves public ticket by share token', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [
        {
          ...mockTicketRow,
          share_token: 'valid_secure_share_token_123456',
        },
      ],
    } as never);

    const ticket = await invoiceTrackingService.getByShareToken('valid_secure_share_token_123456');
    expect(ticket.bien_so).toBe('51H99999');
    expect(ticket.id).toBe(10);
  });

  it('rejects invalid or too short share token', async () => {
    await expect(invoiceTrackingService.getByShareToken('short')).rejects.toThrow('Mã chia sẻ không hợp lệ');
  });
});
