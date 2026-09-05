import { pool } from '../config/database';

export interface AccountantInvoice {
  id: number;
  batch_id: string;
  ngay: string;
  so_xe: string;
  so_hoa_don: string;
  trang_thai: string;
  ghi_chu: string;
  created_at: string;
  ten_kh: string;
  dia_chi: string;
  nha_cung_cap: string;
}

export interface AccountantInvoiceFilters {
  page?: number;
  limit?: number;
  batch_id?: string;
  ngay_from?: string;
  ngay_to?: string;
  so_xe?: string;
  so_hoa_don?: string;
  trang_thai?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function rowToInvoice(row: Record<string, unknown>): AccountantInvoice {
  return {
    id: row.id as number,
    batch_id: row.batch_id as string,
    ngay: row.ngay as string,
    so_xe: row.so_xe as string,
    so_hoa_don: row.so_hoa_don as string,
    trang_thai: row.trang_thai as string,
    ghi_chu: row.ghi_chu as string,
    created_at: row.created_at instanceof Date
      ? (row.created_at as Date).toISOString()
      : (row.created_at as string),
    ten_kh: row.ten_kh as string,
    dia_chi: row.dia_chi as string,
    nha_cung_cap: row.nha_cung_cap as string,
  };
}

export interface MissingInvoice {
  so_hoa_don: string;
  ten_kh: string;
  dia_chi: string;
  nha_cung_cap: string;
}

export interface MissingDateGroup {
  ngay: string;
  invoices: MissingInvoice[];
}

export interface MissingVehicle {
  so_xe: string;
  missing_count: number;
  in_catalog: boolean;
  dates: MissingDateGroup[];
}

export const accountantInvoiceService = {
  async list(filters: AccountantInvoiceFilters = {}): Promise<PaginatedResult<AccountantInvoice>> {
    const page = filters.page || 1;
    const limit = filters.limit || 30;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters.batch_id) {
      conditions.push(`ai.batch_id = $${paramIndex++}`);
      params.push(filters.batch_id);
    }
    if (filters.ngay_from) {
      conditions.push(`ai.ngay >= $${paramIndex++}`);
      params.push(filters.ngay_from);
    }
    if (filters.ngay_to) {
      conditions.push(`ai.ngay <= $${paramIndex++}`);
      params.push(filters.ngay_to);
    }
    if (filters.so_xe) {
      conditions.push(`ai.so_xe ILIKE $${paramIndex++}`);
      params.push(`%${filters.so_xe}%`);
    }
    if (filters.so_hoa_don) {
      conditions.push(`ai.so_hoa_don ILIKE $${paramIndex++}`);
      params.push(`%${filters.so_hoa_don}%`);
    }
    if (filters.trang_thai) {
      conditions.push(`ai.trang_thai = $${paramIndex++}`);
      params.push(filters.trang_thai);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM accountant_invoices ai ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(total / limit);

    const dataResult = await pool.query(
      `SELECT ai.id, ai.batch_id, ai.ngay::text as ngay, ai.so_xe, ai.so_hoa_don,
              ai.trang_thai, ai.ghi_chu, ai.created_at,
              COALESCE(MIN(dd.ten_kh), '') AS ten_kh,
              COALESCE(MIN(dd.dia_chi), '') AS dia_chi,
              COALESCE(
                MIN(s.name),
                (SELECT name FROM suppliers WHERE supplier_code = 'default' AND status = 'active')
              ) AS nha_cung_cap
       FROM accountant_invoices ai
       LEFT JOIN delivery_data dd ON
         dd.ngay_hd = ai.ngay
         AND regexp_replace(
               regexp_replace(
                 regexp_replace(dd.so_tau_xe, '^[^0-9]*', ''),
                 '[-,\\s]', '', 'g'
               ),
               '/.*$', ''
             ) = ai.so_xe
         AND trim(dd.so_hd) = ai.so_hoa_don
       LEFT JOIN suppliers s ON s.supplier_code = dd.ma_ncc AND s.status = 'active'
       ${whereClause}
       GROUP BY ai.id
       ORDER BY ai.ngay DESC, ai.so_xe ASC, ai.so_hoa_don ASC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset],
    );

    return {
      data: dataResult.rows.map(rowToInvoice),
      pagination: { page, limit, total, totalPages },
    };
  },

  async getMissingSummary(batchId?: string, inCatalog?: boolean): Promise<MissingVehicle[]> {
    const conditions: string[] = ["ai.trang_thai = 'không có'"];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (batchId) {
      conditions.push(`ai.batch_id = $${paramIndex++}`);
      params.push(batchId);
    }

    if (inCatalog === true) {
      conditions.push('v.id IS NOT NULL');
    } else if (inCatalog === false) {
      conditions.push('v.id IS NULL');
    }

    const whereClause = conditions.join(' AND ');

    const result = await pool.query<{
      so_xe: string;
      ngay: string;
      so_hoa_don: string;
      ten_kh: string;
      dia_chi: string;
      nha_cung_cap: string;
      in_catalog: boolean;
    }>(
      `SELECT ai.so_xe, ai.ngay::text as ngay, ai.so_hoa_don,
              COALESCE(MIN(dd.ten_kh), '') AS ten_kh,
              COALESCE(MIN(dd.dia_chi), '') AS dia_chi,
              COALESCE(
                MIN(s.name),
                (SELECT name FROM suppliers WHERE supplier_code = 'default' AND status = 'active')
              ) AS nha_cung_cap,
              (v.id IS NOT NULL) AS in_catalog
       FROM accountant_invoices ai
       LEFT JOIN vehicles v ON
         regexp_replace(
           regexp_replace(
              regexp_replace(v.plate_number, '^[^0-9]*', ''),
             '[-,\\s]', '', 'g'
           ),
           '/.*$', ''
         ) = ai.so_xe
         AND v.status = 'active'
        LEFT JOIN delivery_data dd ON
          dd.ngay_hd = ai.ngay
          AND regexp_replace(
                regexp_replace(
                  regexp_replace(dd.so_tau_xe, '^[^0-9]*', ''),
                  '[-,\\s]', '', 'g'
                ),
                '/.*$', ''
              ) = ai.so_xe
          AND trim(dd.so_hd) = ai.so_hoa_don
        LEFT JOIN suppliers s ON s.supplier_code = dd.ma_ncc AND s.status = 'active'
       WHERE ${whereClause}
       GROUP BY ai.so_xe, ai.ngay, ai.so_hoa_don, v.id
       ORDER BY ai.so_xe ASC, ai.ngay DESC, ai.so_hoa_don ASC`,
      params,
    );

    const vehicleMap = new Map<string, { dates: Map<string, MissingInvoice[]>; in_catalog: boolean }>();

    for (const row of result.rows) {
      let vehicle = vehicleMap.get(row.so_xe);
      if (!vehicle) {
        vehicle = { dates: new Map(), in_catalog: row.in_catalog };
        vehicleMap.set(row.so_xe, vehicle);
      }

      const dateList = vehicle.dates.get(row.ngay);
      if (dateList) {
        dateList.push({ so_hoa_don: row.so_hoa_don, ten_kh: row.ten_kh, dia_chi: row.dia_chi, nha_cung_cap: row.nha_cung_cap });
      } else {
        vehicle.dates.set(row.ngay, [{ so_hoa_don: row.so_hoa_don, ten_kh: row.ten_kh, dia_chi: row.dia_chi, nha_cung_cap: row.nha_cung_cap }]);
      }
    }

    return Array.from(vehicleMap.entries()).map(([so_xe, v]) => {
      const dates: MissingDateGroup[] = Array.from(v.dates.entries()).map(([ngay, invoices]) => ({
        ngay,
        invoices,
      }));
      const missing_count = dates.reduce((sum, d) => sum + d.invoices.length, 0);
      return { so_xe, missing_count, in_catalog: v.in_catalog, dates };
    });
  },

  async update(id: number, data: { trang_thai: string; ghi_chu?: string | null; so_xe?: string }): Promise<AccountantInvoice> {
    const existing = await this.findById(id);
    if (!existing) {
      throw { code: 'NOT_FOUND' };
    }

    if (existing.trang_thai === 'đã có') {
      throw { code: 'CANNOT_EDIT' };
    }

    const so_xe = data.so_xe
      ? data.so_xe.replace(/^[^\d]*/, '').replace(/[-,\s]/g, '').replace(/\/.*$/, '')
      : existing.so_xe;

    const result = await pool.query(
      `UPDATE accountant_invoices
       SET trang_thai = $1, ghi_chu = $2, so_xe = $3
       WHERE id = $4
       RETURNING id, batch_id, ngay::text as ngay, so_xe, so_hoa_don, trang_thai, ghi_chu, created_at`,
      [data.trang_thai, data.ghi_chu ?? null, so_xe, id],
    );
    return rowToInvoice(result.rows[0]);
  },

  async findById(id: number): Promise<AccountantInvoice | null> {
    const result = await pool.query(
      `SELECT id, batch_id, ngay::text as ngay, so_xe, so_hoa_don, trang_thai, ghi_chu, created_at
       FROM accountant_invoices WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? rowToInvoice(result.rows[0]) : null;
  },
};
