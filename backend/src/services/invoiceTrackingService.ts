import crypto from 'crypto';
import { pool } from '../config/database';
import { DispatchSchedule } from './dispatchScheduleService';
import { DataScope } from '../types/dataScope';
import { workflowService } from './workflowService';
import { UserTicketPermissions } from '../types/workflow';
import { auditService } from './auditService';
import { storageService } from './storageService';

const SAFE_FILENAME_REGEX = /^[a-zA-Z0-9_\-\.]+$/;

function normalizeDateString(d: unknown): string {
  if (!d) return '';
  if (d instanceof Date) {
    return d.toISOString().slice(0, 10);
  }
  const str = String(d).trim();
  if (str.includes('T')) {
    return str.split('T')[0];
  }
  return str.slice(0, 10);
}

function parseDocuments(documents: unknown): DocumentFile[] {
  if (!documents) return [];
  if (Array.isArray(documents)) {
    return documents as DocumentFile[];
  }
  if (typeof documents === 'string') {
    try {
      const parsed = JSON.parse(documents);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export class InvoiceTrackingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'InvoiceTrackingError';
  }
}

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

export interface InvoiceTrackingTicketWithPermissions extends DispatchSchedule {
  user_permissions?: UserTicketPermissions;
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

export const invoiceTrackingService = {
  async list(
    filters: InvoiceTrackingFilters,
    scope?: DataScope,
    currentUser?: { userId: number; role?: string; roleId?: number | null },
  ): Promise<{ data: InvoiceTrackingTicketWithPermissions[]; pagination: InvoiceTrackingPagination }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.max(1, Math.min(100, filters.limit ?? 20));
    const offset = (page - 1) * limit;

    // Early return if user has 'none' scope
    if (scope && scope.type === 'none') {
      return {
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          total_pages: 0,
        },
      };
    }

    const conditions: string[] = ['invoice_status IS NOT NULL'];
    const params: unknown[] = [];
    let paramIndex = 1;

    // Apply data scope filter
    if (scope) {
      if (scope.type === 'owner') {
        // Owner scope: match by driver_id (user_id của tài xế) or created_by
        conditions.push(`(driver_id = $${paramIndex} OR (driver_id IS NULL AND created_by = $${paramIndex}))`);
        params.push(scope.userId);
        paramIndex++;
      } else if (scope.type === 'entity') {
        if (!scope.entityIds || scope.entityIds.length === 0) {
          return {
            data: [],
            pagination: {
              page,
              limit,
              total: 0,
              total_pages: 0,
            },
          };
        } else if (scope.entityType === 'vehicle') {
          conditions.push(`vehicle_id = ANY($${paramIndex++})`);
          params.push(scope.entityIds);
        } else {
          // driver entity scope
          conditions.push(`driver_id = ANY($${paramIndex++})`);
          params.push(scope.entityIds);
        }
      }
      // 'all' -> no additional WHERE filter
    }

    if (filters.status && filters.status.length > 0) {
      const placeholders = filters.status.map(() => `$${paramIndex++}`).join(', ');
      conditions.push(`invoice_status IN (${placeholders})`);
      params.push(...filters.status);
    }

    if (filters.date_from) {
      conditions.push(`ngay >= $${paramIndex++}`);
      params.push(filters.date_from);
    }

    if (filters.date_to) {
      conditions.push(`ngay <= $${paramIndex++}`);
      params.push(filters.date_to);
    }

    if (filters.search && filters.search.trim()) {
      conditions.push(
        `(bien_so ILIKE $${paramIndex} OR tai_xe ILIKE $${paramIndex} OR diem_nhan ILIKE $${paramIndex} OR ghi_chu ILIKE $${paramIndex} OR driver_note ILIKE $${paramIndex} OR supplement_note ILIKE $${paramIndex})`,
      );
      params.push(`%${filters.search.trim()}%`);
      paramIndex++;
    }

    if (filters.ghi_chu && filters.ghi_chu.trim()) {
      conditions.push(
        `(ghi_chu ILIKE $${paramIndex} OR driver_note ILIKE $${paramIndex} OR supplement_note ILIKE $${paramIndex})`,
      );
      params.push(`%${filters.ghi_chu.trim()}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countPromise = pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM dispatch_schedules ${whereClause}`,
      params,
    );

    const dataPromise = pool.query<DispatchSchedule>(
      `SELECT id, ngay, loai_tuyen, loai_xe, xe_type, bien_so, tai_xe, vehicle_id,
              diem_nhan, tan, can, ghi_chu,
              invoice_status, driver_id, dispatcher_id,
              CASE
                WHEN documents IS NULL OR jsonb_typeof(documents) <> 'array' THEN '[]'::jsonb
                ELSE (
                  SELECT COALESCE(jsonb_agg(d - 'file_data'), '[]'::jsonb)
                  FROM jsonb_array_elements(documents) d
                )
              END AS documents,
              supplement_note, driver_note, reviewed_at, completed_at,
              created_by, created_at, updated_at
       FROM dispatch_schedules
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset],
    );

    const [countResult, dataResult] = await Promise.all([countPromise, dataPromise]);

    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    // Attach user_permissions for all tickets via optimized batch evaluation
    const items = await workflowService.attachUserPermissionsBulk(
      'invoice_tracking',
      dataResult.rows,
      currentUser,
    );

    return {
      data: items,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit) || 0,
      },
    };
  },

  async getById(
    id: number,
    scope?: DataScope,
    currentUser?: { userId: number; role?: string; roleId?: number | null },
  ): Promise<InvoiceTrackingTicketWithPermissions> {
    const conditions: string[] = ['id = $1'];
    const params: unknown[] = [id];
    let paramIndex = 2;

    if (scope) {
      if (scope.type === 'none') {
        conditions.push('1=0');
      } else if (scope.type === 'owner') {
        conditions.push(`(driver_id = $${paramIndex} OR (driver_id IS NULL AND created_by = $${paramIndex}))`);
        params.push(scope.userId);
        paramIndex++;
      } else if (scope.type === 'entity') {
        if (!scope.entityIds || scope.entityIds.length === 0) {
          conditions.push('1=0');
        } else if (scope.entityType === 'vehicle') {
          conditions.push(`vehicle_id = ANY($${paramIndex++})`);
          params.push(scope.entityIds);
        } else {
          conditions.push(`driver_id = ANY($${paramIndex++})`);
          params.push(scope.entityIds);
        }
      }
    }

    const result = await pool.query<DispatchSchedule>(
      `SELECT id, ngay, loai_tuyen, loai_xe, xe_type, bien_so, tai_xe, vehicle_id,
              diem_nhan, tan, can, ghi_chu,
              invoice_status, driver_id, dispatcher_id, documents,
              supplement_note, driver_note, reviewed_at, completed_at,
              share_token, created_by, created_at, updated_at
       FROM dispatch_schedules
       WHERE ${conditions.join(' AND ')}`,
      params,
    );

    if (!result.rows[0]) {
      throw new InvoiceTrackingError('NOT_FOUND', 'Không tìm thấy ticket hoặc bạn không có quyền truy cập', 404);
    }

    const ticket = result.rows[0];

    // Compute dynamic permissions for current user if user info provided
    let user_permissions: UserTicketPermissions | undefined;
    if (currentUser) {
      user_permissions = await workflowService.getUserTicketPermissions(
        'invoice_tracking',
        ticket.invoice_status,
        currentUser,
        ticket,
      );
    }

    return {
      ...ticket,
      user_permissions,
    };
  },

  async uploadDocuments(
    id: number,
    files: Array<Express.Multer.File | DocumentFile>,
    driverNote?: string,
    scope?: DataScope,
    currentUser?: { userId: number; role?: string; roleId?: number | null },
  ): Promise<DispatchSchedule> {
    const ticket = await this.getById(id, scope);

    // Validate workflow authorization
    if (currentUser) {
      const authResult = await workflowService.authorizeAction(
        'invoice_tracking',
        ticket.invoice_status,
        'upload_document',
        currentUser,
        ticket,
      );
      if (!authResult.authorized) {
        throw new InvoiceTrackingError('FORBIDDEN', authResult.reason || 'Bạn không có quyền upload chứng từ ở bước này', 403);
      }
    } else if (ticket.invoice_status !== 'created' && ticket.invoice_status !== 'request_supplement') {
      throw new InvoiceTrackingError(
        'INVALID_STATUS',
        'Không thể upload khi ticket đã hoàn thành hoặc đang chờ duyệt',
        400,
      );
    }

    if (!files || files.length === 0) {
      throw new InvoiceTrackingError('NO_FILES', 'Phải có ít nhất 1 file', 400);
    }

    if (files.length > 10) {
      throw new InvoiceTrackingError('TOO_MANY_FILES', 'Tối đa 10 files mỗi lần upload', 400);
    }

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    const processedDocuments: DocumentFile[] = [];
    const now = new Date().toISOString();

    for (const item of files) {
      // Case 1: Multer file from multipart/form-data upload
      if ('buffer' in item && item.buffer) {
        const file = item as Express.Multer.File;
        if (!allowedMimes.includes(file.mimetype)) {
          throw new InvoiceTrackingError(
            'INVALID_MIME_TYPE',
            `File "${file.originalname}" không đúng định dạng (chỉ chấp nhận JPG, PNG, PDF)`,
            400,
          );
        }

        if (file.size > 50 * 1024 * 1024) {
          throw new InvoiceTrackingError(
            'FILE_TOO_LARGE',
            `File "${file.originalname}" vượt quá kích thước tối đa 50MB`,
            400,
          );
        }

        const uploadRes = await storageService.upload(file.buffer, file.originalname, file.mimetype);
        processedDocuments.push({
          filename: uploadRes.filename,
          original_filename: file.originalname,
          file_name: file.originalname,
          mime_type: file.mimetype,
          file_size: file.size,
          note: driverNote || undefined,
          uploaded_at: now,
        });
      }
      // Case 2: Base64 JSON fallback
      else if ('file_data' in item && typeof (item as DocumentFile).file_data === 'string' && (item as DocumentFile).file_data) {
        const doc = item as DocumentFile;
        if (!allowedMimes.includes(doc.mime_type)) {
          throw new InvoiceTrackingError(
            'INVALID_MIME_TYPE',
            `File "${doc.file_name}" không đúng định dạng (chỉ chấp nhận JPG, PNG, PDF)`,
            400,
          );
        }

        const buf = Buffer.from(doc.file_data as string, 'base64');
        if (buf.length > 50 * 1024 * 1024) {
          throw new InvoiceTrackingError(
            'FILE_TOO_LARGE',
            `File "${doc.file_name}" vượt quá kích thước tối đa 50MB`,
            400,
          );
        }

        try {
          const uploadRes = await storageService.upload(buf, doc.file_name || 'document.jpg', doc.mime_type);
          processedDocuments.push({
            filename: uploadRes.filename,
            original_filename: doc.file_name,
            file_name: doc.file_name,
            mime_type: doc.mime_type,
            file_size: buf.length,
            note: doc.note || driverNote || undefined,
            uploaded_at: now,
          });
        } catch {
          // Fallback to storing base64 if MinIO temporarily fails
          processedDocuments.push({
            ...doc,
            uploaded_at: now,
          });
        }
      }
      // Case 3: Already processed reference
      else if ('filename' in item && (item as DocumentFile).filename) {
        processedDocuments.push({
          ...(item as DocumentFile),
          uploaded_at: now,
        });
      }
    }

    const existingDocs = parseDocuments(ticket.documents);
    const newDocuments = [...existingDocs, ...processedDocuments];

    // Determine target status via workflow transition
    const nextStatus = await workflowService.getNextStatus(
      'invoice_tracking',
      ticket.invoice_status,
      'upload_document',
      'pending_review',
    );

    const result = await pool.query<DispatchSchedule>(
      `UPDATE dispatch_schedules
       SET documents = $1,
           driver_note = $2,
           invoice_status = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, ngay, loai_tuyen, loai_xe, xe_type, bien_so, tai_xe, vehicle_id,
                 diem_nhan, tan, can, ghi_chu,
                 invoice_status, driver_id, dispatcher_id, documents,
                 supplement_note, driver_note, reviewed_at, completed_at,
                 share_token, created_by, created_at, updated_at`,
      [JSON.stringify(newDocuments), driverNote ?? null, nextStatus, id],
    );

    const updatedTicket = result.rows[0];

    // Log business audit
    if (currentUser) {
      const stepName = ticket.invoice_status === 'request_supplement' ? 'Bổ sung chứng từ' : 'Tải lên lần đầu';
      auditService.logAudit({
        userId: currentUser.userId,
        username: currentUser.role || 'user',
        action: 'UPLOAD_DOCUMENTS',
        entityType: 'dispatch_schedule',
        entityId: id,
        entityLabel: `Xe ${updatedTicket.bien_so} (${updatedTicket.ngay})`,
        details: {
          step: stepName,
          step_code: ticket.invoice_status,
          file_count: processedDocuments.length,
          files: processedDocuments.map((f) => ({
            file_name: f.original_filename || f.file_name,
            mime_type: f.mime_type,
            note: f.note || null,
          })),
          driver_note: driverNote ?? null,
          prev_status: ticket.invoice_status,
          new_status: nextStatus,
        },
      });
    }

    return updatedTicket;
  },

  async getCopyableTickets(
    id: number,
    scope?: DataScope,
  ): Promise<CopyableTicket[]> {
    const target = await this.getById(id, scope);

    const result = await pool.query<DispatchSchedule>(
      `SELECT id, ngay, loai_tuyen, loai_xe, xe_type, bien_so, tai_xe, vehicle_id,
              diem_nhan, tan, can, ghi_chu,
              invoice_status, documents,
              driver_note, reviewed_at, completed_at, created_at
       FROM dispatch_schedules
       WHERE ngay = $1
         AND id <> $2
         AND invoice_status <> 'created'
         AND documents IS NOT NULL
         AND jsonb_typeof(documents) = 'array'
         AND jsonb_array_length(documents) > 0
       ORDER BY bien_so ASC, created_at ASC`,
      [target.ngay, id],
    );

    return result.rows.map((row) => {
      const rawDocs = parseDocuments(row.documents);
      const previewDocs: DocumentFile[] = rawDocs.map((d) => ({
        filename: d.filename,
        original_filename: d.original_filename || d.file_name,
        file_name: d.original_filename || d.file_name,
        mime_type: d.mime_type,
        file_data: d.file_data,
        file_size: d.file_size,
        note: d.note,
        uploaded_at: d.uploaded_at,
        source_ticket_id: d.source_ticket_id || row.id,
        source_plate_number: d.source_plate_number || row.bien_so,
      }));

      return {
        id: row.id,
        ngay: row.ngay,
        loai_tuyen: row.loai_tuyen,
        loai_xe: row.loai_xe,
        bien_so: row.bien_so,
        tai_xe: row.tai_xe,
        diem_nhan: row.diem_nhan,
        invoice_status: row.invoice_status,
        document_count: previewDocs.length,
        documents: previewDocs,
      };
    });
  },

  async copyDocuments(
    id: number,
    sourceTicketId: number,
    driverNote?: string,
    scope?: DataScope,
    currentUser?: { userId: number; role?: string; roleId?: number | null },
  ): Promise<DispatchSchedule> {
    const target = await this.getById(id, scope);

    // Validate workflow authorization
    if (currentUser) {
      const authResult = await workflowService.authorizeAction(
        'invoice_tracking',
        target.invoice_status,
        'upload_document',
        currentUser,
        target,
      );
      if (!authResult.authorized) {
        throw new InvoiceTrackingError('FORBIDDEN', authResult.reason || 'Bạn không có quyền sao chép chứng từ ở bước này', 403);
      }
    } else if (target.invoice_status !== 'created' && target.invoice_status !== 'request_supplement') {
      throw new InvoiceTrackingError('INVALID_STATUS', 'Không thể sao chép chứng từ khi ticket đã hoàn thành hoặc đang chờ duyệt', 400);
    }

    if (id === sourceTicketId) {
      throw new InvoiceTrackingError('INVALID_SOURCE', 'Không thể sao chép từ chính chuyến xe này', 400);
    }

    const source = await this.getById(sourceTicketId);
    if (normalizeDateString(source.ngay) !== normalizeDateString(target.ngay)) {
      throw new InvoiceTrackingError('INVALID_DATE', 'Chỉ có thể sao chép chứng từ từ chuyến xe cùng ngày', 400);
    }

    const sourceDocs = parseDocuments(source.documents);
    if (sourceDocs.length === 0) {
      throw new InvoiceTrackingError('NO_DOCUMENTS', 'Chuyến xe nguồn chưa có chứng từ nào để sao chép', 400);
    }

    const now = new Date().toISOString();
    const copiedDocs: DocumentFile[] = sourceDocs.map((doc) => ({
      filename: doc.filename,
      original_filename: doc.original_filename || doc.file_name,
      file_name: doc.original_filename || doc.file_name,
      mime_type: doc.mime_type,
      file_data: doc.file_data,
      file_size: doc.file_size,
      note: doc.note || `Sao chép từ xe ${source.bien_so}`,
      uploaded_at: now,
      source_ticket_id: doc.source_ticket_id || source.id,
      source_plate_number: doc.source_plate_number || source.bien_so,
    }));

    const existingDocs = parseDocuments(target.documents);
    const newDocuments = [...existingDocs, ...copiedDocs];

    const nextStatus = await workflowService.getNextStatus(
      'invoice_tracking',
      target.invoice_status,
      'upload_document',
      'pending_review',
    );

    const result = await pool.query<DispatchSchedule>(
      `UPDATE dispatch_schedules
       SET documents = $1,
           driver_note = COALESCE($2, driver_note),
           invoice_status = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, ngay, loai_tuyen, loai_xe, xe_type, bien_so, tai_xe, vehicle_id,
                 diem_nhan, tan, can, ghi_chu,
                 invoice_status, driver_id, dispatcher_id, documents,
                 supplement_note, driver_note, reviewed_at, completed_at,
                 share_token, created_by, created_at, updated_at`,
      [JSON.stringify(newDocuments), driverNote ?? null, nextStatus, id],
    );

    const updatedTicket = result.rows[0];

    if (currentUser) {
      const stepName = target.invoice_status === 'request_supplement' ? 'Bổ sung chứng từ (Sao chép)' : 'Sao chép chứng từ';
      auditService.logAudit({
        userId: currentUser.userId,
        username: currentUser.role || 'user',
        action: 'UPLOAD_DOCUMENTS',
        entityType: 'dispatch_schedule',
        entityId: id,
        entityLabel: `Xe ${target.bien_so} (${target.ngay})`,
        details: {
          step: stepName,
          step_code: target.invoice_status,
          is_copy: true,
          source_ticket_id: source.id,
          source_plate_number: source.bien_so,
          file_count: copiedDocs.length,
          files: copiedDocs.map((f) => ({
            file_name: f.original_filename || f.file_name,
            mime_type: f.mime_type,
            note: f.note || null,
          })),
          driver_note: driverNote ?? null,
          prev_status: target.invoice_status,
          new_status: nextStatus,
        },
      });
    }

    return updatedTicket;
  },

  async serveFile(filename: string): Promise<string> {
    if (!filename || typeof filename !== 'string' || !SAFE_FILENAME_REGEX.test(filename) || filename.includes('..')) {
      throw new InvoiceTrackingError('INVALID_FILENAME', 'Tên tệp không hợp lệ', 400);
    }
    return storageService.getPublicUrl(filename);
  },

  async review(
    id: number,
    action: 'finish' | 'request_supplement',
    dispatcherId: number,
    supplementNote?: string,
    currentUser?: { userId: number; role?: string; roleId?: number | null },
  ): Promise<DispatchSchedule> {
    const ticket = await this.getById(id);

    const actionCode = action === 'finish' ? 'review_finish' : 'request_supplement';

    // Validate workflow authorization
    if (currentUser) {
      const authResult = await workflowService.authorizeAction(
        'invoice_tracking',
        ticket.invoice_status,
        actionCode,
        currentUser,
        ticket,
      );
      if (!authResult.authorized) {
        throw new InvoiceTrackingError('FORBIDDEN', authResult.reason || 'Bạn không có quyền thực hiện hành động này ở bước hiện tại', 403);
      }
    } else if (ticket.invoice_status !== 'pending_review') {
      throw new InvoiceTrackingError(
        'INVALID_STATUS',
        'Chỉ có thể duyệt khi ticket ở trạng thái Chờ duyệt',
        400,
      );
    }

    if (action === 'request_supplement') {
      if (!supplementNote || supplementNote.trim().length < 5) {
        throw new InvoiceTrackingError(
          'SUPPLEMENT_NOTE_REQUIRED',
          'Ghi chú bổ sung là bắt buộc (tối thiểu 5 ký tự)',
          400,
        );
      }

      const nextStatus = await workflowService.getNextStatus(
        'invoice_tracking',
        ticket.invoice_status,
        'request_supplement',
        'request_supplement',
      );

      const result = await pool.query<DispatchSchedule>(
        `UPDATE dispatch_schedules
         SET invoice_status = $1,
             dispatcher_id = $2,
             supplement_note = $3,
             reviewed_at = NOW(),
             updated_at = NOW()
         WHERE id = $4
         RETURNING id, ngay, loai_tuyen, loai_xe, xe_type, bien_so, tai_xe, vehicle_id,
                   diem_nhan, tan, can, ghi_chu,
                   invoice_status, driver_id, dispatcher_id, documents,
                   supplement_note, driver_note, reviewed_at, completed_at,
                   created_by, created_at, updated_at`,
        [nextStatus, dispatcherId, supplementNote.trim(), id],
      );

      const updatedTicket = result.rows[0];

      if (currentUser) {
        auditService.logAudit({
          userId: currentUser.userId,
          username: currentUser.role || 'dispatcher',
          action: 'REQUEST_SUPPLEMENT',
          entityType: 'dispatch_schedule',
          entityId: id,
          entityLabel: `Xe ${updatedTicket.bien_so} (${updatedTicket.ngay})`,
          details: {
            supplement_note: supplementNote.trim(),
            prev_status: ticket.invoice_status,
            new_status: nextStatus,
          },
        });
      }

      return updatedTicket;
    }

    if (action === 'finish') {
      const nextStatus = await workflowService.getNextStatus(
        'invoice_tracking',
        ticket.invoice_status,
        'review_finish',
        'completed',
      );

      const isCompleted = nextStatus === 'completed';

      const result = await pool.query<DispatchSchedule>(
        `UPDATE dispatch_schedules
         SET invoice_status = $1,
             dispatcher_id = $2,
             reviewed_at = NOW(),
             completed_at = CASE WHEN $3 = TRUE THEN NOW() ELSE completed_at END,
             updated_at = NOW()
         WHERE id = $4
         RETURNING id, ngay, loai_tuyen, loai_xe, xe_type, bien_so, tai_xe, vehicle_id,
                   diem_nhan, tan, can, ghi_chu,
                   invoice_status, driver_id, dispatcher_id, documents,
                   supplement_note, driver_note, reviewed_at, completed_at,
                   created_by, created_at, updated_at`,
        [nextStatus, dispatcherId, isCompleted, id],
      );

      const updatedTicket = result.rows[0];

      if (currentUser) {
        auditService.logAudit({
          userId: currentUser.userId,
          username: currentUser.role || 'dispatcher',
          action: 'REVIEW_FINISH',
          entityType: 'dispatch_schedule',
          entityId: id,
          entityLabel: `Xe ${updatedTicket.bien_so} (${updatedTicket.ngay})`,
          details: {
            prev_status: ticket.invoice_status,
            new_status: nextStatus,
          },
        });
      }

      return updatedTicket;
    }

    throw new InvoiceTrackingError('INVALID_ACTION', 'Action không hợp lệ', 400);
  },

  async getHistory(
    id: number,
    scope?: DataScope,
  ): Promise<InvoiceTrackingHistoryItem[]> {
    // Check permission to view ticket first
    const ticket = await this.getById(id, scope);

    // Query audit logs
    const auditRes = await pool.query<{
      id: number;
      action: string;
      user_id: number | null;
      username: string | null;
      user_full_name: string | null;
      details: Record<string, unknown> | null;
      created_at: string;
    }>(
      `SELECT a.id, a.action, a.user_id, a.username, u.full_name as user_full_name, a.details, a.created_at
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE a.entity_type = 'dispatch_schedule' AND a.entity_id = $1
       ORDER BY a.created_at ASC`,
      [id],
    );

    const historyItems: InvoiceTrackingHistoryItem[] = auditRes.rows.map((row) => {
      let action_label = row.action;
      const details = row.details as Record<string, any> | null;

      if (row.action === 'CREATE' || row.action === 'CREATE_DISPATCH') {
        action_label = 'Tạo chuyến xe';
      } else if (row.action === 'UPLOAD_DOCUMENTS') {
        if (details?.step_code === 'request_supplement' || details?.prev_status === 'request_supplement') {
          action_label = 'Bổ sung chứng từ';
        } else {
          action_label = 'Tải lên chứng từ';
        }
      } else if (row.action === 'REQUEST_SUPPLEMENT') {
        action_label = 'Yêu cầu bổ sung';
      } else if (row.action === 'REVIEW_FINISH') {
        action_label = 'Duyệt hoàn thành';
      } else if (row.action === 'UPDATE') {
        action_label = 'Cập nhật chuyến xe';
      }

      return {
        ...row,
        action_label,
      };
    });

    // If no explicit CREATE audit log exists (e.g. legacy schedules), prepend a synthetic created event
    const hasCreateLog = historyItems.some((h) => h.action === 'CREATE' || h.action === 'CREATE_DISPATCH');
    if (!hasCreateLog && ticket.created_at) {
      let creatorName: string | null = null;
      if (ticket.created_by) {
        const creatorRes = await pool.query<{ full_name: string; username: string }>(
          `SELECT full_name, username FROM users WHERE id = $1`,
          [ticket.created_by],
        );
        if (creatorRes.rows[0]) {
          creatorName = creatorRes.rows[0].full_name || creatorRes.rows[0].username;
        }
      }

      historyItems.unshift({
        id: 0,
        action: 'CREATE',
        action_label: 'Tạo chuyến xe',
        user_id: ticket.created_by,
        username: null,
        user_full_name: creatorName,
        details: {
          bien_so: ticket.bien_so,
          loai_tuyen: ticket.loai_tuyen,
          loai_xe: ticket.loai_xe,
        },
        created_at: ticket.created_at,
      });
    }

    return historyItems;
  },

  async getStatistics(
    filters: InvoiceTrackingStatisticsFilters,
    scope?: DataScope,
  ): Promise<InvoiceTrackingStatisticsResult> {
    const emptyResult: InvoiceTrackingStatisticsResult = {
      summary: {
        total_tickets: 0,
        created_count: 0,
        pending_review_count: 0,
        request_supplement_count: 0,
        completed_count: 0,
        completion_rate: 0,
      },
      by_driver: [],
    };

    if (scope && scope.type === 'none') {
      return emptyResult;
    }

    const conditions: string[] = ['ds.invoice_status IS NOT NULL'];
    const params: unknown[] = [];
    let paramIndex = 1;

    // Apply data scope
    if (scope) {
      if (scope.type === 'owner') {
        conditions.push(`(ds.driver_id = $${paramIndex} OR (ds.driver_id IS NULL AND ds.created_by = $${paramIndex}))`);
        params.push(scope.userId);
        paramIndex++;
      } else if (scope.type === 'entity') {
        if (!scope.entityIds || scope.entityIds.length === 0) {
          return emptyResult;
        }
        if (scope.entityType === 'vehicle') {
          conditions.push(`ds.vehicle_id = ANY($${paramIndex++})`);
          params.push(scope.entityIds);
        } else {
          conditions.push(`ds.driver_id = ANY($${paramIndex++})`);
          params.push(scope.entityIds);
        }
      }
    }

    // Filters
    if (filters.date_from) {
      conditions.push(`ds.ngay >= $${paramIndex++}`);
      params.push(filters.date_from);
    }

    if (filters.date_to) {
      conditions.push(`ds.ngay <= $${paramIndex++}`);
      params.push(filters.date_to);
    }

    if (filters.bien_so) {
      conditions.push(`ds.bien_so ILIKE $${paramIndex++}`);
      params.push(`%${filters.bien_so.trim()}%`);
    }

    if (filters.driver_id) {
      conditions.push(`ds.driver_id = $${paramIndex++}`);
      params.push(filters.driver_id);
    } else if (filters.tai_xe) {
      conditions.push(`(COALESCE(u.full_name, ds.tai_xe) ILIKE $${paramIndex++} OR ds.tai_xe ILIKE $${paramIndex - 1})`);
      params.push(`%${filters.tai_xe.trim()}%`);
    }

    if (filters.ghi_chu) {
      conditions.push(`(ds.ghi_chu ILIKE $${paramIndex} OR ds.driver_note ILIKE $${paramIndex} OR ds.supplement_note ILIKE $${paramIndex})`);
      params.push(`%${filters.ghi_chu.trim()}%`);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Query aggregated statistics by driver
    const query = `
      SELECT
        ds.driver_id,
        COALESCE(u.full_name, ds.tai_xe, 'Chưa gán tài xế') as driver_name,
        COALESCE(
          array_agg(DISTINCT ds.bien_so) FILTER (WHERE ds.bien_so IS NOT NULL AND ds.bien_so <> ''),
          '{}'
        ) as vehicles,
        COUNT(*)::int as total_tickets,
        COUNT(*) FILTER (WHERE ds.invoice_status = 'created')::int as created_count,
        COUNT(*) FILTER (WHERE ds.invoice_status = 'pending_review')::int as pending_review_count,
        COUNT(*) FILTER (WHERE ds.invoice_status = 'request_supplement')::int as request_supplement_count,
        COUNT(*) FILTER (WHERE ds.invoice_status = 'completed')::int as completed_count
      FROM dispatch_schedules ds
      LEFT JOIN users u ON u.id = ds.driver_id
      ${whereClause}
      GROUP BY ds.driver_id, COALESCE(u.full_name, ds.tai_xe, 'Chưa gán tài xế')
      ORDER BY total_tickets DESC, driver_name ASC
    `;

    const result = await pool.query<{
      driver_id: number | null;
      driver_name: string;
      vehicles: string[];
      total_tickets: number;
      created_count: number;
      pending_review_count: number;
      request_supplement_count: number;
      completed_count: number;
    }>(query, params);

    let total_tickets = 0;
    let created_count = 0;
    let pending_review_count = 0;
    let request_supplement_count = 0;
    let completed_count = 0;

    const by_driver: DriverInvoiceStatistics[] = result.rows.map((row) => {
      const rowTotal = row.total_tickets || 0;
      const rowCompleted = row.completed_count || 0;
      const rate = rowTotal > 0 ? Math.round((rowCompleted / rowTotal) * 1000) / 10 : 0;

      total_tickets += rowTotal;
      created_count += row.created_count || 0;
      pending_review_count += row.pending_review_count || 0;
      request_supplement_count += row.request_supplement_count || 0;
      completed_count += rowCompleted;

      return {
        driver_id: row.driver_id,
        driver_name: row.driver_name,
        vehicles: row.vehicles || [],
        total_tickets: rowTotal,
        created_count: row.created_count || 0,
        pending_review_count: row.pending_review_count || 0,
        request_supplement_count: row.request_supplement_count || 0,
        completed_count: rowCompleted,
        completion_rate: rate,
      };
    });

    const overallRate = total_tickets > 0 ? Math.round((completed_count / total_tickets) * 1000) / 10 : 0;

    return {
      summary: {
        total_tickets,
        created_count,
        pending_review_count,
        request_supplement_count,
        completed_count,
        completion_rate: overallRate,
      },
      by_driver,
    };
  },

  async getOrCreateShareToken(
    id: number,
    currentUser?: { userId: number; role?: string; roleId?: number | null },
  ): Promise<{ share_token: string }> {
    const ticket = await this.getById(id);

    if (ticket.share_token) {
      return { share_token: ticket.share_token };
    }

    const token = crypto.randomBytes(24).toString('hex');
    await pool.query(
      `UPDATE dispatch_schedules SET share_token = $1 WHERE id = $2`,
      [token, id],
    );

    if (currentUser) {
      auditService.logAudit({
        userId: currentUser.userId,
        username: currentUser.role || 'user',
        action: 'SHARE_TICKET',
        entityType: 'dispatch_schedule',
        entityId: id,
        entityLabel: `Xe ${ticket.bien_so} (${ticket.ngay})`,
        details: { share_token: token },
      });
    }

    return { share_token: token };
  },

  async getByShareToken(token: string): Promise<PublicInvoiceTicket> {
    if (!token || typeof token !== 'string' || token.trim().length < 10) {
      throw new InvoiceTrackingError('INVALID_TOKEN', 'Mã chia sẻ không hợp lệ', 400);
    }

    const result = await pool.query<DispatchSchedule>(
      `SELECT id, ngay, loai_tuyen, loai_xe, xe_type, bien_so, tai_xe, vehicle_id,
              diem_nhan, tan, can, ghi_chu,
              invoice_status, documents,
              driver_note, reviewed_at, completed_at,
              created_at
       FROM dispatch_schedules
       WHERE share_token = $1`,
      [token.trim()],
    );

    if (!result.rows[0]) {
      throw new InvoiceTrackingError('NOT_FOUND', 'Liên kết chia sẻ không tồn tại hoặc đã hết hạn', 404);
    }

    const row = result.rows[0];
    const docs = parseDocuments(row.documents);

    return {
      id: row.id,
      ngay: row.ngay,
      loai_tuyen: row.loai_tuyen,
      loai_xe: row.loai_xe,
      xe_type: row.xe_type,
      bien_so: row.bien_so,
      tai_xe: row.tai_xe,
      diem_nhan: row.diem_nhan,
      tan: row.tan,
      can: row.can,
      ghi_chu: row.ghi_chu,
      invoice_status: row.invoice_status,
      documents: docs,
      driver_note: row.driver_note,
      reviewed_at: row.reviewed_at,
      completed_at: row.completed_at,
      created_at: row.created_at,
    };
  },
};
