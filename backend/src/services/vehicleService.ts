import { pool } from '../config/database';
import * as XLSX from 'xlsx';

export interface Vehicle {
  id: number;
  plate_number: string;
  driver_name: string;
  vehicle_type: string;
  status: 'active' | 'deactive';
  oil_change_interval_km: number;
  driver_count?: number;
  created_at: string;
  updated_at: string;
}

export interface VehicleListResult {
  vehicles: Vehicle[];
  total: number;
  page: number;
  limit: number;
}

export interface UploadResult {
  imported: number;
  reactivated: number;
}

export interface UploadError {
  row: number;
  driver_name: string;
  plate_number: string;
  reason: string;
}

export interface VehicleData {
  driver_name: string;
  plate_number: string;
  vehicle_type?: string;
}

const SELECT_COLS = `
  id, plate_number, driver_name, vehicle_type, status, oil_change_interval_km, created_at, updated_at
`;

function normalizePlateNumber(raw: string): string | null {
  const cleaned = raw
    .replace(/^[^\d]*/, '')
    .replace(/[-,\s.]/g, '')
    .replace(/\/.*$/, '')
    .toUpperCase();

  if (!/^\d{2}[A-Z]\d{4,}$/.test(cleaned)) return null;

  return cleaned;
}

export const vehicleService = {
  async getAll(
    search?: string,
    status?: string,
    vehicle_type?: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<VehicleListResult> {
    const offset = (page - 1) * limit;
    const params: unknown[] = [];
    let whereClause = '';
    const conditions: string[] = [];

    if (status === 'active') {
      conditions.push("v.status = 'active'");
    } else if (status === 'inactive') {
      conditions.push("v.status = 'deactive'");
    } else if (status === 'all') {
      // no status filter
    } else {
      conditions.push("v.status = 'active'");
    }

    if (vehicle_type === 'Xe nhà' || vehicle_type === 'Xe ngoài') {
      conditions.push(`v.vehicle_type = '${vehicle_type}'`);
    }

    if (conditions.length > 0) {
      whereClause = `WHERE ${conditions.join(' AND ')}`;
    }
    let countWhereClause = whereClause;

    if (search) {
      const q = `%${search}%`;
      params.push(q, q);
      const and = countWhereClause ? ' AND ' : 'WHERE ';
      whereClause += `${and}(v.plate_number ILIKE $${params.length - 1} OR v.driver_name ILIKE $${params.length})`;
      countWhereClause += `${and}(v.plate_number ILIKE $1 OR v.driver_name ILIKE $2)`;
    }

    const countParams: unknown[] = [];
    if (search) {
      const q = `%${search}%`;
      countParams.push(q, q);
    }
    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM vehicles v ${countWhereClause}`,
      countParams,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(limit, offset);
    const dataResult = await pool.query<Vehicle>(
      `SELECT 
        v.id, 
        v.plate_number, 
        v.driver_name, 
        v.vehicle_type, 
        v.status, 
        v.oil_change_interval_km, 
        v.created_at, 
        v.updated_at,
        COUNT(DISTINCT dv.driver_id)::int as driver_count
       FROM vehicles v
       LEFT JOIN driver_vehicles dv ON dv.vehicle_id = v.id
       LEFT JOIN drivers d ON d.id = dv.driver_id AND d.status = 'active'
       ${whereClause}
       GROUP BY v.id
       ORDER BY v.plate_number ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { vehicles: dataResult.rows, total, page, limit };
  },

  async findById(id: number): Promise<Vehicle | null> {
    const result = await pool.query<Vehicle>(
      `SELECT ${SELECT_COLS} FROM vehicles WHERE id = $1`,
      [id],
    );
    return result.rows[0] || null;
  },

  async findByPlateNumber(plateNumber: string): Promise<Vehicle | null> {
    const result = await pool.query<Vehicle>(
      `SELECT ${SELECT_COLS} FROM vehicles WHERE plate_number = $1 AND status = 'active'`,
      [plateNumber],
    );
    return result.rows[0] || null;
  },

  async softDelete(id: number): Promise<void> {
    const existing = await this.findById(id);
    if (!existing || existing.status !== 'active') {
      throw { code: 'NOT_FOUND' };
    }

    await pool.query(
      `UPDATE vehicles SET status = 'deactive' WHERE id = $1`,
      [id],
    );
  },

  async create(data: VehicleData): Promise<Vehicle> {
    const normalized = normalizePlateNumber(data.plate_number);
    if (!normalized) {
      throw { code: 'INVALID_PLATE', message: `Biển số không đúng định dạng: ${data.plate_number}` };
    }

    const existingActive = await this.findByPlateNumber(normalized);
    if (existingActive) {
      throw { code: 'DUPLICATE_PLATE', message: `Biển số đã tồn tại: ${normalized}` };
    }

    const deactivated = await pool.query<Vehicle>(
      `SELECT id FROM vehicles WHERE plate_number = $1 AND status = 'deactive'`,
      [normalized],
    );

    const vehicle_type = data.vehicle_type || 'Xe nhà';

    if (deactivated.rows.length > 0) {
      const result = await pool.query<Vehicle>(
        `UPDATE vehicles SET status = 'active', driver_name = $1, vehicle_type = $2 WHERE id = $3 RETURNING ${SELECT_COLS}`,
        [data.driver_name, vehicle_type, deactivated.rows[0].id],
      );
      return result.rows[0];
    }

    const result = await pool.query<Vehicle>(
      `INSERT INTO vehicles (plate_number, driver_name, vehicle_type) VALUES ($1, $2, $3) RETURNING ${SELECT_COLS}`,
      [normalized, data.driver_name, vehicle_type],
    );
    return result.rows[0];
  },

  async toggleStatus(id: number): Promise<Vehicle> {
    const existing = await this.findById(id);
    if (!existing) {
      throw { code: 'NOT_FOUND' };
    }

    const newStatus = existing.status === 'active' ? 'deactive' : 'active';
    const result = await pool.query<Vehicle>(
      `UPDATE vehicles SET status = $1 WHERE id = $2 RETURNING ${SELECT_COLS}`,
      [newStatus, id],
    );
    return result.rows[0];
  },

  async updateOilInterval(id: number, intervalKm: number): Promise<Vehicle> {
    const existing = await this.findById(id);
    if (!existing) {
      throw { code: 'NOT_FOUND' };
    }

    const result = await pool.query<Vehicle>(
      `UPDATE vehicles SET oil_change_interval_km = $1 WHERE id = $2 RETURNING ${SELECT_COLS}`,
      [intervalKm, id],
    );
    return result.rows[0];
  },

  async getSummary(vehicleId: number): Promise<{
    vehicle: Vehicle;
    inspection: { status: string; expiry_date: string | null; count: number };
    insurance: { status: string; expiry_date: string | null; count: number };
    oil_change: { status: string; last_change_date: string | null; last_odometer: number | null; current_km: number | null; km_since_change: number | null };
    repair: { count: number; total_amount: number };
    fuel: { avg_fuel_rate: number | null; last_odometer: number | null; record_count: number };
  }> {
    const vehicle = await this.findById(vehicleId);
    if (!vehicle) {
      throw { code: 'NOT_FOUND' };
    }

    const [inspectionRes, insuranceRes, oilRes, repairRes, fuelRes] = await Promise.all([
      pool.query<{ id: number; expiry_date: string; status: string; inspection_count: number }>(
        `SELECT id, expiry_date, status,
          (SELECT COUNT(*) FROM inspection_records WHERE vehicle_id = $1 AND status IN ('active','expired','superseded'))::int AS inspection_count
         FROM inspection_records
         WHERE vehicle_id = $1 AND status = 'active'
         ORDER BY inspection_date DESC LIMIT 1`,
        [vehicleId],
      ),
      pool.query<{ id: number; expiry_date: string; status: string; insurance_count: number }>(
        `SELECT id, expiry_date, status,
          (SELECT COUNT(*) FROM insurance_records WHERE vehicle_id = $1 AND status IN ('active','expired','superseded'))::int AS insurance_count
         FROM insurance_records
         WHERE vehicle_id = $1 AND status = 'active'
         ORDER BY purchase_date DESC LIMIT 1`,
        [vehicleId],
      ),
      pool.query<{ id: number; change_date: string; odometer_at: number }>(
        `SELECT id, change_date, odometer_at
         FROM oil_change_records
         WHERE vehicle_id = $1 AND status = 'active'
         ORDER BY change_date DESC LIMIT 1`,
        [vehicleId],
      ),
      pool.query<{ repair_count: number; total_amount: string }>(
        `SELECT COUNT(*)::int AS repair_count,
                COALESCE(SUM(total_amount), 0)::text AS total_amount
         FROM repair_records
         WHERE vehicle_id = $1 AND status = 'active'`,
        [vehicleId],
      ),
      pool.query<{ record_count: number; last_odometer: number | null; avg_fuel_rate: string | null }>(
        `WITH recent AS (
           SELECT odometer_new, fuel_rate
           FROM fuel_records WHERE vehicle_id = $1
           ORDER BY record_date DESC LIMIT 10
         )
         SELECT
           (SELECT COUNT(*)::int FROM fuel_records WHERE vehicle_id = $1) AS record_count,
           (SELECT MAX(odometer_new) FROM fuel_records WHERE vehicle_id = $1) AS last_odometer,
           (SELECT AVG(fuel_rate) FROM recent WHERE fuel_rate IS NOT NULL)::text AS avg_fuel_rate`,
        [vehicleId],
      ),
    ]);

    const insp = inspectionRes.rows[0] || null;
    const ins = vehicle.vehicle_type === 'Xe nhà' ? (insuranceRes.rows[0] || null) : null;
    const oil = oilRes.rows[0] || null;
    const rep = repairRes.rows[0];
    const fuel = fuelRes.rows[0];

    const currentKm = fuel?.last_odometer ?? null;
    const lastOilOdo = oil?.odometer_at ?? null;
    const kmSinceChange = (currentKm !== null && lastOilOdo !== null) ? currentKm - lastOilOdo : null;

    let oilStatus = 'no_data';
    if (oil) {
      oilStatus = 'ok';
      if (kmSinceChange !== null && vehicle.oil_change_interval_km > 0) {
        const pct = kmSinceChange / vehicle.oil_change_interval_km;
        if (kmSinceChange > vehicle.oil_change_interval_km) {
          oilStatus = 'overdue';
        } else if (pct >= 0.8) {
          oilStatus = 'due_soon';
        }
      }
    }

    return {
      vehicle,
      inspection: insp
        ? { status: insp.status, expiry_date: insp.expiry_date, count: insp.inspection_count }
        : { status: 'none', expiry_date: null, count: 0 },
      insurance: vehicle.vehicle_type === 'Xe ngoài'
        ? { status: 'not_applicable', expiry_date: null, count: 0 }
        : ins
          ? { status: ins.status, expiry_date: ins.expiry_date, count: ins.insurance_count }
          : { status: 'none', expiry_date: null, count: 0 },
      oil_change: {
        status: oilStatus,
        last_change_date: oil?.change_date ?? null,
        last_odometer: lastOilOdo,
        current_km: currentKm,
        km_since_change: kmSinceChange,
      },
      repair: {
        count: rep?.repair_count ?? 0,
        total_amount: parseInt(rep?.total_amount ?? '0', 10),
      },
      fuel: {
        avg_fuel_rate: fuel?.avg_fuel_rate ? parseFloat(fuel.avg_fuel_rate) : null,
        last_odometer: currentKm,
        record_count: fuel?.record_count ?? 0,
      },
    };
  },

  async update(id: number, data: { driver_name: string; vehicle_type?: string }): Promise<Vehicle> {
    const existing = await this.findById(id);
    if (!existing) {
      throw { code: 'NOT_FOUND' };
    }

    const vehicle_type = data.vehicle_type || existing.vehicle_type;
    const result = await pool.query<Vehicle>(
      `UPDATE vehicles SET driver_name = $1, vehicle_type = $2 WHERE id = $3 RETURNING ${SELECT_COLS}`,
      [data.driver_name, vehicle_type, id],
    );
    return result.rows[0];
  },

  async uploadFromExcel(
    fileBuffer: Buffer,
  ): Promise<{ result?: UploadResult; errors?: UploadError[] }> {
    const wb = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = wb.SheetNames.find(
      (s) => s.toLowerCase().trim() === 'xe',
    );

    if (!sheetName) {
      return {
        errors: [{ row: 0, driver_name: '', plate_number: '', reason: "Không tìm thấy sheet 'xe' trong file" }],
      };
    }

    const ws = wb.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });

    const errors: UploadError[] = [];
    const rowsToInsert: { driver_name: string; plate_number: string }[] = [];
    const seenPlates = new Map<string, number>();

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i] as unknown[];
      const rowNum = i + 1;

      if (row.length === 0) continue;

      const col0 = String(row[0] ?? '').trim();
      const col1 = String(row[1] ?? '').trim();

      if (!col0 && !col1) continue;

      const normalized0 = col0.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normalized1 = col1.toLowerCase().replace(/[^a-z0-9]/g, '');
      if ((col0 === 'MA' && normalized1 === 'soxe') || (normalized0 === 'ma' && col1 === 'SỐ XE')) {
        continue;
      }

      if (!col0 || !col1) continue;

      const normalized = normalizePlateNumber(col1);
      if (!normalized) {
        errors.push({
          row: rowNum,
          driver_name: col0,
          plate_number: col1,
          reason: `Biển số không đúng định dạng sau chuẩn hóa: ${col1}`,
        });
        continue;
      }

      if (seenPlates.has(normalized)) {
        errors.push({
          row: rowNum,
          driver_name: col0,
          plate_number: col1,
          reason: `Biển số trùng với dòng ${seenPlates.get(normalized)}: ${normalized}`,
        });
        continue;
      }
      seenPlates.set(normalized, rowNum);

      const existing = await this.findByPlateNumber(normalized);
      if (existing) {
        errors.push({
          row: rowNum,
          driver_name: col0,
          plate_number: col1,
          reason: `Biển số đã tồn tại: ${normalized}`,
        });
        continue;
      }

      rowsToInsert.push({ driver_name: col0, plate_number: normalized });
    }

    if (rowsToInsert.length === 0 && errors.length === 0) {
      return { errors: [{ row: 0, driver_name: '', plate_number: '', reason: 'Không có dữ liệu hợp lệ trong sheet xe' }] };
    }

    if (errors.length > 0) {
      return { errors };
    }

    let imported = 0;
    let reactivated = 0;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const row of rowsToInsert) {
        const deactivated = await client.query<Vehicle>(
          `SELECT id FROM vehicles WHERE plate_number = $1 AND status = 'deactive'`,
          [row.plate_number],
        );

        if (deactivated.rows.length > 0) {
          await client.query(
            `UPDATE vehicles SET status = 'active', driver_name = $1, vehicle_type = 'Xe nhà' WHERE id = $2`,
            [row.driver_name, deactivated.rows[0].id],
          );
          reactivated++;
        } else {
          await client.query(
            `INSERT INTO vehicles (plate_number, driver_name, vehicle_type) VALUES ($1, $2, 'Xe nhà')`,
            [row.plate_number, row.driver_name],
          );
          imported++;
        }
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return { result: { imported, reactivated } };
  },
};
