import { pool } from '../config/database';

export function normalizePlateNumber(raw: string): string {
  if (!raw) return '';
  const cleaned = raw
    .replace(/\u00a0/g, '')
    .replace(/^[^\d]*/, '')
    .replace(/[-,\s./\\_]/g, '')
    .replace(/\/.*$/, '')
    .toUpperCase()
    .trim();

  const match = cleaned.match(/(\d{2}[A-Z]\d{4,})/);
  if (match) {
    return match[1];
  }

  return cleaned;
}

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
  invoice_status: 'created' | 'pending_review' | 'completed' | 'request_supplement';
  driver_id: number | null;
  dispatcher_id: number | null;
  documents: any[];
  supplement_note: string | null;
  driver_note: string | null;
  reviewed_at: string | null;
  completed_at: string | null;
  share_token?: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateDispatchScheduleData {
  diem_nhan: string;
  tan?: string | null;
  can?: string | null;
  ghi_chu?: string | null;
}

export interface CreateDispatchScheduleData {
  ngay: string;
  loai_tuyen: 'Tuyến cố định' | 'Tuyến ngoài';
  loai_xe: 'Xe lớn' | 'Xe nhỏ';
  xe_type: 'Xe nhà' | 'Xe ngoài';
  bien_so?: string;
  tai_xe?: string | null;
  vehicle_id?: number | null;
  driver_id?: number | null;
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

export const dispatchScheduleService = {
  async listByDate(
    date: string,
  ): Promise<{ xe_nho: DispatchSchedule[]; xe_lon: DispatchSchedule[]; tuyen_ngoai: DispatchSchedule[] }> {
    const result = await pool.query<DispatchSchedule>(
      `SELECT id, ngay, loai_tuyen, loai_xe, xe_type, bien_so, tai_xe, vehicle_id,
               diem_nhan, tan, can,
               ghi_chu, invoice_status, created_by, created_at, updated_at
         FROM dispatch_schedules
         WHERE ngay = $1
         ORDER BY loai_xe ASC, created_at ASC`,
      [date],
    );

    const xe_nho = result.rows.filter(
      (r) => r.loai_tuyen === 'Tuyến cố định' && r.loai_xe === 'Xe nhỏ',
    );
    const xe_lon = result.rows.filter(
      (r) => r.loai_tuyen === 'Tuyến cố định' && r.loai_xe === 'Xe lớn',
    );
    const tuyen_ngoai = result.rows.filter((r) => r.loai_tuyen === 'Tuyến ngoài');

    return { xe_nho, xe_lon, tuyen_ngoai };
  },

  async create(data: CreateDispatchScheduleData, userId: number | null): Promise<DispatchSchedule> {
    const bien_so = data.bien_so ? normalizePlateNumber(data.bien_so) : null;
    let vehicle_id = data.vehicle_id ?? null;
    let driver_id = data.driver_id ?? null;
    let tai_xe = data.tai_xe ?? null;

    if (!vehicle_id && bien_so) {
      const vRes = await pool.query<{ id: number; driver_name: string }>(
        'SELECT id, driver_name FROM vehicles WHERE plate_number = $1 AND status = \'active\' LIMIT 1',
        [bien_so],
      );
      if (vRes.rows.length > 0) {
        vehicle_id = vRes.rows[0].id;
        if (!tai_xe && vRes.rows[0].driver_name && vRes.rows[0].driver_name !== 'Chưa có tên') {
          tai_xe = vRes.rows[0].driver_name;
        }
      }
    }

    if (vehicle_id && !driver_id) {
      const dRes = await pool.query<{ user_id: number; full_name: string }>(
        `SELECT d.user_id, u.full_name
         FROM driver_vehicles dv
         JOIN drivers d ON d.id = dv.driver_id
         JOIN users u ON u.id = d.user_id
         WHERE dv.vehicle_id = $1 AND d.status = 'active'
         ORDER BY dv.created_at ASC
         LIMIT 1`,
        [vehicle_id],
      );
      if (dRes.rows.length > 0) {
        driver_id = dRes.rows[0].user_id;
        if (!tai_xe || tai_xe === 'Chưa có tên') {
          tai_xe = dRes.rows[0].full_name;
        }
      }
    }

    if (!driver_id) {
      throw new Error(
        `Không tìm thấy tài xế (driver_id) cho biển số: ${bien_so || 'Không xác định'}. Không thể tạo chuyến xe vào database. Vui lòng phân công tài xế trong Danh mục tài xế trước.`,
      );
    }

    const xe_type = vehicle_id ? 'Xe nhà' : (data.xe_type || 'Xe ngoài');

    const result = await pool.query<DispatchSchedule>(
      `INSERT INTO dispatch_schedules
          (ngay, loai_tuyen, loai_xe, xe_type, bien_so, tai_xe, vehicle_id, driver_id,
            diem_nhan, tan, can, ghi_chu, created_by, invoice_status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'created')
        RETURNING id, ngay, loai_tuyen, loai_xe, xe_type, bien_so, tai_xe, vehicle_id, driver_id,
                  diem_nhan, tan, can,
                  ghi_chu, invoice_status, created_by, created_at, updated_at`,
      [
        data.ngay,
        data.loai_tuyen,
        data.loai_xe,
        xe_type,
        bien_so,
        tai_xe,
        vehicle_id,
        driver_id,
        data.diem_nhan,
        data.tan ?? null,
        data.can ?? null,
        data.ghi_chu ?? null,
        userId,
      ],
    );

    return result.rows[0];
  },

  async createBatch(
    items: CreateDispatchScheduleBatchItem[],
    userId: number | null,
  ): Promise<DispatchSchedule[]> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const results: DispatchSchedule[] = [];
      const missingDriverPlates: string[] = [];

      for (const item of items) {
        const bien_so = item.bien_so ? normalizePlateNumber(item.bien_so) : item.bien_so;
        let vehicle_id = item.vehicle_id ?? null;
        let driver_id = item.driver_id ?? null;
        let tai_xe = item.tai_xe ?? null;

        if (!vehicle_id && bien_so) {
          const vRes = await client.query<{ id: number; driver_name: string }>(
            'SELECT id, driver_name FROM vehicles WHERE plate_number = $1 AND status = \'active\' LIMIT 1',
            [bien_so],
          );
          if (vRes.rows.length > 0) {
            vehicle_id = vRes.rows[0].id;
            if (!tai_xe && vRes.rows[0].driver_name && vRes.rows[0].driver_name !== 'Chưa có tên') {
              tai_xe = vRes.rows[0].driver_name;
            }
          }
        }

        if (vehicle_id && !driver_id) {
          const dRes = await client.query<{ user_id: number; full_name: string }>(
            `SELECT d.user_id, u.full_name
             FROM driver_vehicles dv
             JOIN drivers d ON d.id = dv.driver_id
             JOIN users u ON u.id = d.user_id
             WHERE dv.vehicle_id = $1 AND d.status = 'active'
             ORDER BY dv.created_at ASC
             LIMIT 1`,
            [vehicle_id],
          );
          if (dRes.rows.length > 0) {
            driver_id = dRes.rows[0].user_id;
            if (!tai_xe || tai_xe === 'Chưa có tên') {
              tai_xe = dRes.rows[0].full_name;
            }
          }
        }

        if (!driver_id) {
          missingDriverPlates.push(bien_so || 'Không xác định');
          continue;
        }

        const xe_type = vehicle_id ? 'Xe nhà' : 'Xe ngoài';

        const result = await client.query<DispatchSchedule>(
          `INSERT INTO dispatch_schedules
              (ngay, loai_tuyen, loai_xe, xe_type, bien_so, tai_xe, vehicle_id, driver_id,
                diem_nhan, tan, can, ghi_chu, created_by, invoice_status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'created')
            RETURNING id, ngay, loai_tuyen, loai_xe, xe_type, bien_so, tai_xe, vehicle_id, driver_id,
                      diem_nhan, tan, can, ghi_chu, invoice_status, created_by, created_at, updated_at`,
          [
            item.ngay,
            item.loai_tuyen,
            item.loai_xe,
            xe_type,
            bien_so,
            tai_xe,
            vehicle_id,
            driver_id,
            item.diem_nhan,
            item.tan ?? null,
            item.can ?? null,
            item.ghi_chu ?? null,
            userId,
          ],
        );
        results.push(result.rows[0]);
      }

      if (missingDriverPlates.length > 0) {
        const uniquePlates = Array.from(new Set(missingDriverPlates)).join(', ');
        throw new Error(
          `Không tìm thấy tài xế (driver_id) cho các biển số: ${uniquePlates}. Các chuyến xe này không thể insert vào database. Vui lòng phân công tài xế trong Danh mục tài xế.`,
        );
      }

      await client.query('COMMIT');
      return results;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async update(id: number, data: UpdateDispatchScheduleData): Promise<DispatchSchedule | null> {
    const result = await pool.query<DispatchSchedule>(
      `UPDATE dispatch_schedules
          SET diem_nhan = $1, tan = $2, can = $3,
              ghi_chu = $4, updated_at = NOW()
        WHERE id = $5
        RETURNING id, ngay, loai_tuyen, loai_xe, xe_type, bien_so, tai_xe, vehicle_id,
                  diem_nhan, tan, can,
                  ghi_chu, invoice_status, created_by, created_at, updated_at`,
      [
        data.diem_nhan,
        data.tan ?? null,
        data.can ?? null,
        data.ghi_chu ?? null,
        id,
      ],
    );
    return result.rows[0] ?? null;
  },

  async remove(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM dispatch_schedules WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  },
};
