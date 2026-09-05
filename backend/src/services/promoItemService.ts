import { pool } from '../config/database';

export interface PromoItem {
  id: number;
  code: string;
  product_name: string;
  unit_weight_kg: number;
  status: 'active' | 'deactive';
  created_at: string;
  updated_at: string;
}

export interface PromoItemData {
  code: string;
  product_name: string;
  unit_weight_kg: number;
}

export interface PromoItemListResult {
  items: PromoItem[];
  total: number;
  page: number;
  limit: number;
}

const SELECT_COLS = `
  id, code, product_name, unit_weight_kg, status, created_at, updated_at
`;

export const promoItemService = {
  async getAll(
    search?: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<PromoItemListResult> {
    const offset = (page - 1) * limit;
    const params: unknown[] = [];
    let whereClause = "WHERE status = 'active'";
    let countWhereClause = "WHERE status = 'active'";

    if (search) {
      const q = `%${search}%`;
      params.push(q, q);
      whereClause += ` AND (code ILIKE $${params.length - 1} OR product_name ILIKE $${params.length})`;
      countWhereClause += ` AND (code ILIKE $1 OR product_name ILIKE $2)`;
    }

    const countParams: unknown[] = [];
    if (search) {
      countParams.push(`%${search}%`, `%${search}%`);
    }
    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM promo_items ${countWhereClause}`,
      countParams,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(limit, offset);
    const dataResult = await pool.query<PromoItem>(
      `SELECT ${SELECT_COLS} FROM promo_items ${whereClause}
       ORDER BY code ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { items: dataResult.rows, total, page, limit };
  },

  async findById(id: number): Promise<PromoItem | null> {
    const result = await pool.query<PromoItem>(
      `SELECT ${SELECT_COLS} FROM promo_items WHERE id = $1`,
      [id],
    );
    return result.rows[0] || null;
  },

  async findByCode(code: string, excludeId?: number): Promise<PromoItem | null> {
    let query = `SELECT ${SELECT_COLS} FROM promo_items WHERE code = $1 AND status = 'active'`;
    const params: unknown[] = [code];
    if (excludeId) {
      query += ' AND id != $2';
      params.push(excludeId);
    }
    const result = await pool.query<PromoItem>(query, params);
    return result.rows[0] || null;
  },

  async create(data: PromoItemData): Promise<PromoItem> {
    const existing = await this.findByCode(data.code);
    if (existing) {
      throw { code: 'DUPLICATE_CODE' };
    }

    const result = await pool.query<PromoItem>(
      `INSERT INTO promo_items (code, product_name, unit_weight_kg)
       VALUES ($1, $2, $3)
       RETURNING ${SELECT_COLS}`,
      [data.code, data.product_name, data.unit_weight_kg],
    );
    return result.rows[0];
  },

  async update(id: number, data: PromoItemData): Promise<PromoItem> {
    const existing = await this.findById(id);
    if (!existing || existing.status !== 'active') {
      throw { code: 'NOT_FOUND' };
    }

    const duplicate = await this.findByCode(data.code, id);
    if (duplicate) {
      throw { code: 'DUPLICATE_CODE' };
    }

    const result = await pool.query<PromoItem>(
      `UPDATE promo_items
       SET code = $1, product_name = $2, unit_weight_kg = $3
       WHERE id = $4
       RETURNING ${SELECT_COLS}`,
      [data.code, data.product_name, data.unit_weight_kg, id],
    );
    return result.rows[0];
  },

  async softDelete(id: number): Promise<void> {
    const existing = await this.findById(id);
    if (!existing || existing.status !== 'active') {
      throw { code: 'NOT_FOUND' };
    }

    await pool.query(
      `UPDATE promo_items SET status = 'deactive' WHERE id = $1`,
      [id],
    );
  },
};
