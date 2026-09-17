import { pool } from '../config/database';

export interface AssignedVehicle {
  id: number;
  plate_number: string;
  driver_name: string;
  vehicle_type: string;
}

export interface Driver {
  id: number;
  user_id: number;
  full_name: string;
  username: string;
  email: string;
  status: 'active' | 'deactive';
  notes: string | null;
  vehicles: AssignedVehicle[];
  created_at: string;
  updated_at: string;
}

export interface DriverListResult {
  drivers: Driver[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateDriverData {
  user_id: number;
  vehicle_ids: number[];
  notes?: string | null;
}

export interface UpdateDriverData {
  vehicle_ids: number[];
  notes?: string | null;
}

export interface AvailableUser {
  id: number;
  username: string;
  full_name: string;
  email: string;
}

export interface AvailableVehicle {
  id: number;
  plate_number: string;
  driver_name: string;
  vehicle_type: string;
}

export const driverService = {
  async getAll(params: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<DriverListResult> {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const queryParams: unknown[] = [];

    if (params.status === 'active') {
      conditions.push("d.status = 'active'");
    } else if (params.status === 'inactive') {
      conditions.push("d.status = 'deactive'");
    } else if (params.status === 'all') {
      // no status condition
    } else {
      conditions.push("d.status = 'active'");
    }

    if (params.search && params.search.trim() !== '') {
      const q = `%${params.search.trim()}%`;
      queryParams.push(q, q, q);
      const pIdx1 = queryParams.length - 2;
      const pIdx2 = queryParams.length - 1;
      const pIdx3 = queryParams.length;
      conditions.push(
        `(u.full_name ILIKE $${pIdx1} OR u.username ILIKE $${pIdx2} OR EXISTS (
          SELECT 1 FROM driver_vehicles dv2
          JOIN vehicles v2 ON v2.id = dv2.vehicle_id
          WHERE dv2.driver_id = d.id AND v2.plate_number ILIKE $${pIdx3}
        ))`,
      );
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count query
    const countQuery = `
      SELECT COUNT(DISTINCT d.id) as count
      FROM drivers d
      JOIN users u ON u.id = d.user_id
      ${whereClause}
    `;
    const countResult = await pool.query<{ count: string }>(countQuery, queryParams);
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    // Data query
    const dataParams = [...queryParams, limit, offset];
    const dataQuery = `
      SELECT 
        d.id,
        d.user_id,
        u.full_name,
        u.username,
        u.email,
        d.status,
        d.notes,
        d.created_at,
        d.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', v.id,
              'plate_number', v.plate_number,
              'driver_name', v.driver_name,
              'vehicle_type', v.vehicle_type
            )
          ) FILTER (WHERE v.id IS NOT NULL),
          '[]'
        ) as vehicles
      FROM drivers d
      JOIN users u ON u.id = d.user_id
      LEFT JOIN driver_vehicles dv ON dv.driver_id = d.id
      LEFT JOIN vehicles v ON v.id = dv.vehicle_id
      ${whereClause}
      GROUP BY d.id, u.id
      ORDER BY d.created_at DESC
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
    `;

    const dataResult = await pool.query<Driver>(dataQuery, dataParams);

    return {
      drivers: dataResult.rows,
      total,
      page,
      limit,
    };
  },

  async findById(id: number): Promise<Driver | null> {
    const query = `
      SELECT 
        d.id,
        d.user_id,
        u.full_name,
        u.username,
        u.email,
        d.status,
        d.notes,
        d.created_at,
        d.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', v.id,
              'plate_number', v.plate_number,
              'driver_name', v.driver_name,
              'vehicle_type', v.vehicle_type
            )
          ) FILTER (WHERE v.id IS NOT NULL),
          '[]'
        ) as vehicles
      FROM drivers d
      JOIN users u ON u.id = d.user_id
      LEFT JOIN driver_vehicles dv ON dv.driver_id = d.id
      LEFT JOIN vehicles v ON v.id = dv.vehicle_id
      WHERE d.id = $1
      GROUP BY d.id, u.id
    `;
    const result = await pool.query<Driver>(query, [id]);
    return result.rows[0] || null;
  },

  async getAvailableUsers(currentDriverId?: number): Promise<AvailableUser[]> {
    let query = `
      SELECT u.id, u.username, u.full_name, u.email
      FROM users u
      WHERE u.is_active = true
    `;

    const params: unknown[] = [];
    if (currentDriverId) {
      query += `
        AND (
          u.id NOT IN (SELECT user_id FROM drivers WHERE status = 'active' AND id != $1)
        )
      `;
      params.push(currentDriverId);
    } else {
      query += `
        AND u.id NOT IN (SELECT user_id FROM drivers WHERE status = 'active')
      `;
    }

    query += ` ORDER BY u.full_name ASC`;

    const result = await pool.query<AvailableUser>(query, params);
    return result.rows;
  },

  async getAvailableVehicles(): Promise<AvailableVehicle[]> {
    const query = `
      SELECT id, plate_number, driver_name, vehicle_type
      FROM vehicles
      WHERE status = 'active'
      ORDER BY plate_number ASC
    `;
    const result = await pool.query<AvailableVehicle>(query);
    return result.rows;
  },

  async create(data: CreateDriverData): Promise<Driver> {
    // Validate user active
    const userRes = await pool.query('SELECT id, is_active FROM users WHERE id = $1', [data.user_id]);
    if (!userRes.rows[0] || !userRes.rows[0].is_active) {
      throw { code: 'INVALID_USER', message: 'Tài khoản người dùng không tồn tại hoặc không hoạt động' };
    }

    // Check if user already an active driver
    const existing = await pool.query('SELECT id FROM drivers WHERE user_id = $1 AND status = \'active\'', [data.user_id]);
    if (existing.rows.length > 0) {
      throw { code: 'DUPLICATE_DRIVER', message: 'Tài khoản người dùng này đã được gán làm tài xế' };
    }

    // Validate vehicles: must be active
    if (data.vehicle_ids && data.vehicle_ids.length > 0) {
      const vCheck = await pool.query(
        `SELECT id FROM vehicles WHERE id = ANY($1::int[]) AND status = 'active'`,
        [data.vehicle_ids],
      );
      if (vCheck.rows.length !== data.vehicle_ids.length) {
        throw { code: 'INVALID_VEHICLE', message: 'Có xe không hợp lệ hoặc đang không hoạt động' };
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if user was a deactive driver -> reactivate or insert new
      const deactiveRes = await client.query(
        `SELECT id FROM drivers WHERE user_id = $1 AND status = 'deactive'`,
        [data.user_id],
      );

      let driverId: number;
      if (deactiveRes.rows.length > 0) {
        driverId = deactiveRes.rows[0].id;
        await client.query(
          `UPDATE drivers SET status = 'active', notes = $1, updated_at = NOW() WHERE id = $2`,
          [data.notes ?? null, driverId],
        );
        // Clear previous vehicles
        await client.query(`DELETE FROM driver_vehicles WHERE driver_id = $1`, [driverId]);
      } else {
        const insRes = await client.query(
          `INSERT INTO drivers (user_id, notes) VALUES ($1, $2) RETURNING id`,
          [data.user_id, data.notes ?? null],
        );
        driverId = insRes.rows[0].id;
      }

      if (data.vehicle_ids && data.vehicle_ids.length > 0) {
        for (const vId of data.vehicle_ids) {
          await client.query(
            `INSERT INTO driver_vehicles (driver_id, vehicle_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [driverId, vId],
          );
        }
      }

      await client.query('COMMIT');

      const fullDriver = await this.findById(driverId);
      return fullDriver!;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async update(id: number, data: UpdateDriverData): Promise<Driver> {
    const existing = await this.findById(id);
    if (!existing) {
      throw { code: 'NOT_FOUND', message: 'Không tìm thấy tài xế' };
    }

    // Validate vehicles
    if (data.vehicle_ids && data.vehicle_ids.length > 0) {
      const vCheck = await pool.query(
        `SELECT id FROM vehicles WHERE id = ANY($1::int[]) AND status = 'active'`,
        [data.vehicle_ids],
      );
      if (vCheck.rows.length !== data.vehicle_ids.length) {
        throw { code: 'INVALID_VEHICLE', message: 'Có xe không hợp lệ hoặc đang không hoạt động' };
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE drivers SET notes = $1, updated_at = NOW() WHERE id = $2`,
        [data.notes ?? null, id],
      );

      // Replace assigned vehicles
      await client.query(`DELETE FROM driver_vehicles WHERE driver_id = $1`, [id]);

      if (data.vehicle_ids && data.vehicle_ids.length > 0) {
        for (const vId of data.vehicle_ids) {
          await client.query(
            `INSERT INTO driver_vehicles (driver_id, vehicle_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [id, vId],
          );
        }
      }

      await client.query('COMMIT');

      const updatedDriver = await this.findById(id);
      return updatedDriver!;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async toggleStatus(id: number): Promise<Driver> {
    const existing = await this.findById(id);
    if (!existing) {
      throw { code: 'NOT_FOUND', message: 'Không tìm thấy tài xế' };
    }

    const newStatus = existing.status === 'active' ? 'deactive' : 'active';
    await pool.query(
      `UPDATE drivers SET status = $1, updated_at = NOW() WHERE id = $2`,
      [newStatus, id],
    );

    const updated = await this.findById(id);
    return updated!;
  },

  async softDelete(id: number): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) {
      throw { code: 'NOT_FOUND' };
    }
    await pool.query(`UPDATE drivers SET status = 'deactive', updated_at = NOW() WHERE id = $1`, [id]);
  },

  async getDriversByVehicle(vehicleId: number): Promise<{ id: number; user_id: number; full_name: string; username: string }[]> {
    const query = `
      SELECT d.id, d.user_id, u.full_name, u.username
      FROM drivers d
      JOIN driver_vehicles dv ON dv.driver_id = d.id
      JOIN users u ON u.id = d.user_id
      WHERE dv.vehicle_id = $1 AND d.status = 'active'
      ORDER BY dv.created_at ASC
    `;
    const result = await pool.query(query, [vehicleId]);
    return result.rows;
  },
};
