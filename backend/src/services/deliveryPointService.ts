import { pool } from '../config/database';

export interface DeliveryPoint {
  id: number;
  code: string;
  address: string;
  notes: string | null;
  status: 'active' | 'deactive';
  created_at: string;
  updated_at: string;
}

export interface DeliveryPointData {
  code: string;
  address: string;
  notes?: string | null;
}

export interface DeliveryPointListResult {
  items: DeliveryPoint[];
  total: number;
  page: number;
  limit: number;
}

const SELECT_COLS = `
  id, code, address, notes, status, created_at, updated_at
`;

export const deliveryPointService = {
  async getAll(
    search?: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<DeliveryPointListResult> {
    const offset = (page - 1) * limit;
    const params: unknown[] = [];
    let whereClause = "WHERE status = 'active'";
    let countWhereClause = "WHERE status = 'active'";

    if (search) {
      const q = `%${search}%`;
      params.push(q, q);
      whereClause += ` AND (code ILIKE $${params.length - 1} OR address ILIKE $${params.length})`;
      countWhereClause += ` AND (code ILIKE $1 OR address ILIKE $2)`;
    }

    const countParams: unknown[] = [];
    if (search) {
      countParams.push(`%${search}%`, `%${search}%`);
    }
    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM delivery_points ${countWhereClause}`,
      countParams,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(limit, offset);
    const dataResult = await pool.query<DeliveryPoint>(
      `SELECT ${SELECT_COLS} FROM delivery_points ${whereClause}
       ORDER BY code ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { items: dataResult.rows, total, page, limit };
  },

  async findById(id: number): Promise<DeliveryPoint | null> {
    const result = await pool.query<DeliveryPoint>(
      `SELECT ${SELECT_COLS} FROM delivery_points WHERE id = $1`,
      [id],
    );
    return result.rows[0] || null;
  },

  async findByCode(code: string, excludeId?: number): Promise<DeliveryPoint | null> {
    let query = `SELECT ${SELECT_COLS} FROM delivery_points WHERE code = $1 AND status = 'active'`;
    const params: unknown[] = [code];
    if (excludeId) {
      query += ' AND id != $2';
      params.push(excludeId);
    }
    const result = await pool.query<DeliveryPoint>(query, params);
    return result.rows[0] || null;
  },

  async create(data: DeliveryPointData): Promise<DeliveryPoint> {
    const existing = await this.findByCode(data.code);
    if (existing) {
      throw { code: 'DUPLICATE_CODE' };
    }

    const result = await pool.query<DeliveryPoint>(
      `INSERT INTO delivery_points (code, address, notes)
       VALUES ($1, $2, $3)
       RETURNING ${SELECT_COLS}`,
      [data.code, data.address, data.notes ?? null],
    );
    return result.rows[0];
  },

  async update(id: number, data: DeliveryPointData): Promise<DeliveryPoint> {
    const existing = await this.findById(id);
    if (!existing || existing.status !== 'active') {
      throw { code: 'NOT_FOUND' };
    }

    const duplicate = await this.findByCode(data.code, id);
    if (duplicate) {
      throw { code: 'DUPLICATE_CODE' };
    }

    const result = await pool.query<DeliveryPoint>(
      `UPDATE delivery_points
       SET code = $1, address = $2, notes = $3
       WHERE id = $4
       RETURNING ${SELECT_COLS}`,
      [data.code, data.address, data.notes ?? null, id],
    );
    return result.rows[0];
  },

  async softDelete(id: number): Promise<void> {
    const existing = await this.findById(id);
    if (!existing || existing.status !== 'active') {
      throw { code: 'NOT_FOUND' };
    }

    await pool.query(
      `UPDATE delivery_points SET status = 'deactive' WHERE id = $1`,
      [id],
    );
  },
};
