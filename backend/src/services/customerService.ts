import { pool } from '../config/database';

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

function normalizeOptionalText(value?: string | null): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

const SELECT_COLS = `
  c.id, c.diem_tra_hang, c.ten_khach_hang, c.tuyen_phuong, c.tuyen_cu,
  c.dia_chi_giao_hang, c.diem_giao_hang_tinh_phi, c.boc_xep, c.supplier_code,
  c.status, c.created_at, c.updated_at
`;

export const customerService = {
  async list(): Promise<Customer[]> {
    const result = await pool.query(
      `SELECT
         ${SELECT_COLS},
         CASE WHEN s.id IS NOT NULL
           THEN jsonb_build_object('supplier_code', s.supplier_code, 'name', s.name)
           ELSE NULL
         END AS supplier
       FROM customers c
       LEFT JOIN suppliers s ON s.supplier_code = c.supplier_code AND s.status = 'active'
       WHERE c.status = 'active'
       ORDER BY c.diem_tra_hang ASC`,
    );
    return result.rows.map((r) => ({
      ...r,
      supplier: r.supplier as SupplierBrief | null,
    }));
  },

  async findById(id: number): Promise<Customer | null> {
    const result = await pool.query(
      `SELECT ${SELECT_COLS}
       FROM customers c
       WHERE id = $1`,
      [id],
    );
    return result.rows[0] || null;
  },

  async create(data: CustomerData): Promise<Customer> {
    const result = await pool.query(
      `INSERT INTO customers c
         (diem_tra_hang, ten_khach_hang, tuyen_phuong, tuyen_cu, dia_chi_giao_hang,
          diem_giao_hang_tinh_phi, boc_xep, supplier_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${SELECT_COLS}`,
      [
        data.diem_tra_hang,
        data.ten_khach_hang,
        data.tuyen_phuong ?? null,
        data.tuyen_cu ?? null,
        data.dia_chi_giao_hang ?? null,
        normalizeOptionalText(data.diem_giao_hang_tinh_phi),
        data.boc_xep,
        data.supplier_code ?? null,
      ],
    );
    return result.rows[0];
  },

  async update(id: number, data: CustomerData): Promise<Customer> {
    const existing = await this.findById(id);
    if (!existing || existing.status !== 'active') {
      throw { code: 'NOT_FOUND' };
    }

    const result = await pool.query(
      `UPDATE customers c
       SET diem_tra_hang = $1, ten_khach_hang = $2, tuyen_phuong = $3,
           tuyen_cu = $4, dia_chi_giao_hang = $5, diem_giao_hang_tinh_phi = $6,
           boc_xep = $7, supplier_code = $8
       WHERE id = $9
       RETURNING ${SELECT_COLS}`,
      [
        data.diem_tra_hang,
        data.ten_khach_hang,
        data.tuyen_phuong ?? null,
        data.tuyen_cu ?? null,
        data.dia_chi_giao_hang ?? null,
        normalizeOptionalText(data.diem_giao_hang_tinh_phi),
        data.boc_xep,
        data.supplier_code ?? null,
        id,
      ],
    );
    return result.rows[0];
  },

  async softDelete(id: number): Promise<void> {
    const existing = await this.findById(id);
    if (!existing || existing.status !== 'active') {
      throw { code: 'NOT_FOUND' };
    }

    await pool.query(
      `UPDATE customers c SET status = 'deactive' WHERE id = $1`,
      [id],
    );
  },

  async uploadMany(rows: CustomerData[]): Promise<{ inserted: number }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const row of rows) {
        await client.query(
          `INSERT INTO customers c
             (diem_tra_hang, ten_khach_hang, tuyen_phuong, tuyen_cu, dia_chi_giao_hang,
              diem_giao_hang_tinh_phi, boc_xep, supplier_code)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            row.diem_tra_hang,
            row.ten_khach_hang,
            row.tuyen_phuong ?? null,
            row.tuyen_cu ?? null,
            row.dia_chi_giao_hang ?? null,
            normalizeOptionalText(row.diem_giao_hang_tinh_phi),
            row.boc_xep,
            row.supplier_code ?? null,
          ],
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return { inserted: rows.length };
  },
};
