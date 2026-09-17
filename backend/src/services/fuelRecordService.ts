import { pool } from '../config/database';
import * as XLSX from 'xlsx';
import {
  FuelRecord,
  FuelRecordListResult,
  FuelRecordFilters,
  FuelStatistics,
  VehicleFuelStat,
  MonthlyFuelStat,
  UploadResult,
  UploadError,
  CreateFuelRecordInput,
  UpdateFuelRecordInput,
  FuelRecordImage,
} from '../types/fuelRecord';

const SELECT_COLS = `
  fr.id, fr.vehicle_id, to_char(fr.record_date, 'YYYY-MM-DD') as record_date,
  fr.odometer_old, fr.odometer_new, fr.distance, fr.liters, fr.fuel_rate,
  fr.gps_old, fr.gps_new, fr.gps_distance, fr.gps_liters, fr.gps_fuel_rate,
  fr.unit_price, fr.total_cost,
  fr.batch_id, fr.notes, fr.created_by,
  fr.created_at, fr.updated_at,
  v.plate_number, v.driver_name
`;

export const fuelRecordService = {
  async list(filters: FuelRecordFilters): Promise<FuelRecordListResult> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 0;

    if (filters.vehicle_id) {
      paramIndex++;
      conditions.push(`fr.vehicle_id = $${paramIndex}`);
      params.push(filters.vehicle_id);
    }

    if (filters.month) {
      paramIndex++;
      conditions.push(`to_char(fr.record_date, 'YYYY-MM') = $${paramIndex}`);
      params.push(filters.month);
    }

    if (filters.date_from) {
      paramIndex++;
      conditions.push(`fr.record_date >= $${paramIndex}::date`);
      params.push(filters.date_from);
    }

    if (filters.date_to) {
      paramIndex++;
      conditions.push(`fr.record_date <= $${paramIndex}::date`);
      params.push(filters.date_to);
    }

    if (filters.search) {
      paramIndex++;
      conditions.push(`v.plate_number ILIKE $${paramIndex}`);
      params.push(`%${filters.search}%`);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM fuel_records fr JOIN vehicles v ON v.id = fr.vehicle_id ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(limit, offset);
    const dataResult = await pool.query<FuelRecord>(
      `SELECT ${SELECT_COLS}
       FROM fuel_records fr
       JOIN vehicles v ON v.id = fr.vehicle_id
       ${whereClause}
       ORDER BY fr.record_date DESC, v.plate_number ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { records: dataResult.rows, total, page, limit };
  },

  async getById(id: number): Promise<FuelRecord | null> {
    const result = await pool.query<FuelRecord>(
      `SELECT ${SELECT_COLS}
       FROM fuel_records fr
       JOIN vehicles v ON v.id = fr.vehicle_id
       WHERE fr.id = $1`,
      [id],
    );
    return result.rows[0] || null;
  },

  async create(input: CreateFuelRecordInput, userId: number): Promise<FuelRecord> {
    const distance = input.odometer_new - input.odometer_old;
    const fuelRate = distance > 0 ? input.liters * 100 / distance : null;
    const gpsDistance = (input.gps_old != null && input.gps_new != null)
      ? input.gps_new - input.gps_old : null;
    const gpsFuelRate = (gpsDistance != null && gpsDistance > 0 && input.gps_liters != null)
      ? input.gps_liters * 100 / gpsDistance : null;
    const totalCost = input.liters * input.unit_price;

    const result = await pool.query<{ id: number }>(
      `INSERT INTO fuel_records
       (vehicle_id, record_date, odometer_old, odometer_new, distance, liters, fuel_rate,
        gps_old, gps_new, gps_distance, gps_liters, gps_fuel_rate,
        unit_price, total_cost, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id`,
      [input.vehicle_id, input.record_date, input.odometer_old, input.odometer_new,
       distance, input.liters, fuelRate,
       input.gps_old ?? null, input.gps_new ?? null, gpsDistance,
       input.gps_liters ?? null, gpsFuelRate,
       input.unit_price, totalCost, userId],
    );

    return this.getById(result.rows[0].id) as Promise<FuelRecord>;
  },

  async update(id: number, input: UpdateFuelRecordInput): Promise<FuelRecord> {
    const existing = await this.getById(id);
    if (!existing) throw { code: 'NOT_FOUND' };

    const recordDate = input.record_date ?? existing.record_date;
    const vehicleId = input.vehicle_id ?? existing.vehicle_id;
    const odoOld = input.odometer_old ?? existing.odometer_old;
    const odoNew = input.odometer_new ?? existing.odometer_new;
    const liters = input.liters ?? existing.liters;
    const distance = odoNew - odoOld;
    const fuelRate = distance > 0 ? liters * 100 / distance : null;

    const gpsOld = input.gps_old !== undefined ? input.gps_old : existing.gps_old;
    const gpsNew = input.gps_new !== undefined ? input.gps_new : existing.gps_new;
    const gpsLiters = input.gps_liters !== undefined ? input.gps_liters : existing.gps_liters;
    const gpsDistance = (gpsOld != null && gpsNew != null) ? gpsNew - gpsOld : null;
    const gpsFuelRate = (gpsDistance != null && gpsDistance > 0 && gpsLiters != null)
      ? gpsLiters * 100 / gpsDistance : null;

    const unitPrice = input.unit_price ?? existing.unit_price;
    const totalCost = liters * unitPrice;

    await pool.query(
      `UPDATE fuel_records SET
       vehicle_id = $1, record_date = $2,
       odometer_old = $3, odometer_new = $4, distance = $5, liters = $6, fuel_rate = $7,
       gps_old = $8, gps_new = $9, gps_distance = $10, gps_liters = $11, gps_fuel_rate = $12,
       unit_price = $13, total_cost = $14
       WHERE id = $15`,
      [vehicleId, recordDate, odoOld, odoNew, distance, liters, fuelRate,
       gpsOld, gpsNew, gpsDistance, gpsLiters, gpsFuelRate,
       unitPrice, totalCost, id],
    );

    return this.getById(id) as Promise<FuelRecord>;
  },

  async delete(id: number): Promise<void> {
    const result = await pool.query('DELETE FROM fuel_records WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) throw { code: 'NOT_FOUND' };
  },

  async getStatistics(filters: {
    month?: string;
    vehicle_id?: number;
    date_from?: string;
    date_to?: string;
  }): Promise<{
    summary: FuelStatistics;
    byVehicle: VehicleFuelStat[];
    byMonth: MonthlyFuelStat[];
  }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 0;

    if (filters.vehicle_id) {
      paramIndex++;
      conditions.push(`fr.vehicle_id = $${paramIndex}`);
      params.push(filters.vehicle_id);
    }

    if (filters.month) {
      paramIndex++;
      conditions.push(`to_char(fr.record_date, 'YYYY-MM') = $${paramIndex}`);
      params.push(filters.month);
    }

    if (filters.date_from) {
      paramIndex++;
      conditions.push(`fr.record_date >= $${paramIndex}::date`);
      params.push(filters.date_from);
    }

    if (filters.date_to) {
      paramIndex++;
      conditions.push(`fr.record_date <= $${paramIndex}::date`);
      params.push(filters.date_to);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    // Summary
    const summaryResult = await pool.query<FuelStatistics>(
      `SELECT
         COALESCE(SUM(fr.distance), 0) as total_distance,
         COALESCE(SUM(fr.liters), 0) as total_liters,
         COALESCE(SUM(fr.total_cost), 0) as total_cost,
         CASE WHEN SUM(fr.distance) > 0 THEN SUM(fr.liters) * 100.0 / SUM(fr.distance) ELSE NULL END as avg_fuel_rate,
         COALESCE(SUM(fr.gps_distance), 0) as total_gps_distance,
         COALESCE(SUM(fr.gps_liters), 0) as total_gps_liters,
         CASE WHEN SUM(fr.gps_distance) > 0 THEN SUM(fr.gps_liters) * 100.0 / SUM(fr.gps_distance) ELSE NULL END as avg_gps_fuel_rate,
         COUNT(DISTINCT fr.vehicle_id)::int as vehicle_count,
         COUNT(*)::int as record_count
       FROM fuel_records fr ${whereClause}`,
      params,
    );

    // By vehicle
    const byVehicleResult = await pool.query<VehicleFuelStat>(
      `SELECT
         fr.vehicle_id,
         v.plate_number,
         v.driver_name,
         COALESCE(SUM(fr.distance), 0) as total_distance,
         COALESCE(SUM(fr.liters), 0) as total_liters,
         COALESCE(SUM(fr.total_cost), 0) as total_cost,
         CASE WHEN SUM(fr.distance) > 0 THEN SUM(fr.liters) * 100.0 / SUM(fr.distance) ELSE NULL END as avg_fuel_rate,
         COALESCE(SUM(fr.gps_distance), 0) as total_gps_distance,
         COALESCE(SUM(fr.gps_liters), 0) as total_gps_liters,
          CASE WHEN SUM(fr.gps_distance) > 0 THEN SUM(fr.gps_liters) * 100.0 / SUM(fr.gps_distance) ELSE NULL END as avg_gps_fuel_rate,
          (
            SELECT fr2.fuel_rate
            FROM fuel_records fr2
            WHERE fr2.vehicle_id = fr.vehicle_id
              AND fr2.fuel_rate IS NOT NULL
              AND fr2.fuel_rate <= 200
            ORDER BY fr2.record_date DESC, fr2.id DESC
            LIMIT 1
          ) as last_fuel_rate,
          (
            SELECT AVG(fr3.fuel_rate)
            FROM fuel_records fr3
            WHERE fr3.vehicle_id = fr.vehicle_id
              AND fr3.fuel_rate IS NOT NULL
              AND fr3.fuel_rate <= 200
              AND fr3.record_date >= (CURRENT_DATE - INTERVAL '12 months')
          ) as avg_fuel_rate_12m,
          COUNT(*)::int as record_count
       FROM fuel_records fr
       JOIN vehicles v ON v.id = fr.vehicle_id
       ${whereClause}
       GROUP BY fr.vehicle_id, v.plate_number, v.driver_name
       ORDER BY total_distance DESC`,
      params,
    );

    // By month
    const byMonthResult = await pool.query<MonthlyFuelStat>(
      `SELECT
         to_char(fr.record_date, 'YYYY-MM') as month,
         COALESCE(SUM(fr.distance), 0) as total_distance,
         COALESCE(SUM(fr.liters), 0) as total_liters,
         COALESCE(SUM(fr.total_cost), 0) as total_cost,
         CASE WHEN SUM(fr.distance) > 0 THEN SUM(fr.liters) * 100.0 / SUM(fr.distance) ELSE NULL END as avg_fuel_rate,
         COUNT(*)::int as record_count
       FROM fuel_records fr ${whereClause}
       GROUP BY month
       ORDER BY month DESC`,
      params,
    );

    return {
      summary: summaryResult.rows[0],
      byVehicle: byVehicleResult.rows,
      byMonth: byMonthResult.rows,
    };
  },

  async getStatisticsByLocation(filters: {
    month?: string;
  }): Promise<{
    byLocation: {
      location: string;
      month: string;
      total_distance: number;
      total_liters: number;
      total_cost: number;
      avg_fuel_rate: number | null;
      record_count: number;
    }[];
  }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 0;

    if (filters.month) {
      paramIndex++;
      conditions.push(`to_char(fr.record_date, 'YYYY-MM') = $${paramIndex}`);
      params.push(filters.month);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const byLocationResult = await pool.query(
      `SELECT
         COALESCE(fr.location, 'Không xác định') as location,
         to_char(fr.record_date, 'YYYY-MM') as month,
         COALESCE(SUM(fr.distance), 0) as total_distance,
         COALESCE(SUM(fr.liters), 0) as total_liters,
         COALESCE(SUM(fr.total_cost), 0) as total_cost,
         CASE WHEN SUM(fr.distance) > 0 THEN SUM(fr.liters) * 100.0 / SUM(fr.distance) ELSE NULL END as avg_fuel_rate,
         COUNT(*)::int as record_count
       FROM fuel_records fr ${whereClause}
       GROUP BY location, month
       ORDER BY month DESC, location ASC`,
      params,
    );

    return {
      byLocation: byLocationResult.rows,
    };
  },

  async getDistinctMonths(): Promise<string[]> {
    const result = await pool.query<{ month: string }>(
      `SELECT DISTINCT to_char(record_date, 'YYYY-MM') as month
       FROM fuel_records
       ORDER BY month DESC`,
    );
    return result.rows.map((r) => r.month);
  },

  async getLatestOdometer(vehicleId: number): Promise<number | null> {
    const result = await pool.query<{ odometer_new: number }>(
      `SELECT odometer_new
       FROM fuel_records
       WHERE vehicle_id = $1
       ORDER BY record_date DESC, id DESC
       LIMIT 1`,
      [vehicleId],
    );
    return result.rows[0]?.odometer_new ?? null;
  },

  async getVehiclesNeedingMonitoring(thresholdPct: number = 10): Promise<{
    vehicle_id: number;
    plate_number: string;
    driver_name: string;
    last_fuel_rate: number;
    last_record_date: string;
    avg_fuel_rate_12m: number;
    diff_pct: number;
  }[]> {
    const result = await pool.query<{
      vehicle_id: number;
      plate_number: string;
      driver_name: string;
      last_fuel_rate: number;
      last_record_date: string;
      avg_fuel_rate_12m: number;
      diff_pct: number;
    }>(
       `WITH last_record AS (
         SELECT DISTINCT ON (vehicle_id)
           vehicle_id,
           fuel_rate,
           record_date
         FROM fuel_records
         WHERE fuel_rate IS NOT NULL
           AND fuel_rate <= 200
         ORDER BY vehicle_id, record_date DESC, id DESC
       ),
       avg_12m AS (
         SELECT
           vehicle_id,
           AVG(fuel_rate) as avg_rate
         FROM fuel_records
         WHERE fuel_rate IS NOT NULL
           AND fuel_rate <= 200
           AND record_date >= (CURRENT_DATE - INTERVAL '12 months')
         GROUP BY vehicle_id
       )
       SELECT
         v.id as vehicle_id,
         v.plate_number,
         v.driver_name,
         lr.fuel_rate as last_fuel_rate,
         lr.record_date::text as last_record_date,
         a.avg_rate as avg_fuel_rate_12m,
          CASE
            WHEN a.avg_rate > 0 THEN
              ROUND(((lr.fuel_rate - a.avg_rate) / a.avg_rate * 100)::numeric, 2)
            ELSE 0
          END as diff_pct
        FROM last_record lr
        JOIN avg_12m a ON a.vehicle_id = lr.vehicle_id
        JOIN vehicles v ON v.id = lr.vehicle_id
        WHERE a.avg_rate > 0
          AND lr.fuel_rate > a.avg_rate
          AND (lr.fuel_rate - a.avg_rate) / a.avg_rate * 100 >= $1
       ORDER BY diff_pct DESC`,
      [thresholdPct],
    );
    return result.rows;
  },

  async getVehiclesWithoutFuel(days: number = 30): Promise<{
    vehicle_id: number;
    plate_number: string;
    driver_name: string;
    last_record_date: string | null;
    days_since_last: number | null;
  }[]> {
    const result = await pool.query<{
      vehicle_id: number;
      plate_number: string;
      driver_name: string;
      last_record_date: string | null;
      days_since_last: number | null;
    }>(
      `SELECT
         v.id as vehicle_id,
         v.plate_number,
         v.driver_name,
         fr.record_date::text as last_record_date,
         (CURRENT_DATE - fr.record_date::date) as days_since_last
       FROM vehicles v
       LEFT JOIN LATERAL (
         SELECT record_date
         FROM fuel_records
         WHERE vehicle_id = v.id
         ORDER BY record_date DESC
         LIMIT 1
       ) fr ON true
       WHERE v.status = 'active'
         AND (fr.record_date IS NULL OR fr.record_date < (CURRENT_DATE - $1::int))
       ORDER BY
         CASE WHEN fr.record_date IS NULL THEN 0 ELSE 1 END,
         fr.record_date ASC NULLS FIRST`,
      [days],
    );
    return result.rows;
  },

  async deleteByBatch(batchId: string): Promise<number> {
    const result = await pool.query(
      'DELETE FROM fuel_records WHERE batch_id = $1 RETURNING id',
      [batchId],
    );
    return result.rows.length;
  },

  async getBatches(): Promise<{ batch_id: string; record_count: number; uploaded_at: string }[]> {
    const result = await pool.query<{
      batch_id: string;
      record_count: string;
      uploaded_at: string;
    }>(
      `SELECT batch_id, COUNT(*) as record_count, MAX(created_at) as uploaded_at
       FROM fuel_records
       WHERE batch_id IS NOT NULL
       GROUP BY batch_id
       ORDER BY uploaded_at DESC`,
    );
    return result.rows.map((r) => ({
      batch_id: r.batch_id,
      record_count: parseInt(r.record_count, 10),
      uploaded_at: r.uploaded_at,
    }));
  },

  async uploadFromExcel(
    fileBuffer: Buffer,
    userId: number,
  ): Promise<UploadResult> {
    const wb = XLSX.read(fileBuffer, { type: 'buffer' });
    const allErrors: UploadError[] = [];
    let totalImported = 0;

    // Get all vehicles for matching
    const vehicleResult = await pool.query<{ id: number; plate_number: string }>(
      `SELECT id, plate_number FROM vehicles WHERE status = 'active'`,
    );
    const vehicleMap = new Map<string, number>();
    for (const v of vehicleResult.rows) {
      vehicleMap.set(v.plate_number.toUpperCase(), v.id);
      vehicleMap.set(v.plate_number.toUpperCase().replace(/-/g, ''), v.id);
    }

    // Collect ALL rows — grouped by month only for batchId tracking
    const allRows: unknown[][] = [];
    const monthSet = new Set<string>();
    const seenKeys = new Set<string>(); // Track (vehicle_id, record_date) to avoid duplicates

    // Process each sheet — parse rows, month from column A date
    for (let sheetIdx = 0; sheetIdx < wb.SheetNames.length; sheetIdx++) {
      const sheetName = wb.SheetNames[sheetIdx];
      const ws = wb.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });

      let currentLocation = 'ANH HUY';

      // Detect where the header row is: check row 0 vs row 1
      let startRow = 2; // Default: row 0 is Title, row 1 is Header, row 2 is Data
      if (rawRows.length > 0) {
        const r0Str = JSON.stringify(rawRows[0] || '').toUpperCase();
        const r1Str = rawRows.length > 1 ? JSON.stringify(rawRows[1] || '').toUpperCase() : '';
        if (r0Str.includes('NGÀY') && r0Str.includes('SỐ XE')) {
          // Row 0 is header -> Data starts at row 1
          startRow = 1;
        } else if (r1Str.includes('NGÀY') && r1Str.includes('SỐ XE')) {
          // Row 1 is header -> Data starts at row 2
          startRow = 2;
        }
      }

      let lastValidDateInSheet: string | null = null;

      for (let i = startRow; i < rawRows.length; i++) {
        const row = rawRows[i] as unknown[];
        const rowNum = i + 1;

        if (row.length === 0) continue;

        // Detect location marker in column D
        const colD = String(row[3] ?? '').trim();
        if (colD.includes('XE LỚN') && colD.includes('CÂY XĂNG')) {
          currentLocation = 'CÂY XĂNG HIỆP TÂN';
          continue;
        }

        const dateVal = row[0];
        const plateNum = String(row[1] ?? '').trim();
        const odoOld = parseFloat(String(row[2] ?? ''));
        const odoNew = parseFloat(String(row[3] ?? ''));
        const liters = parseFloat(String(row[5] ?? ''));
        const gpsOldRaw = row[7] != null ? String(row[7]) : '';
        const gpsNewRaw = row[8] != null ? String(row[8]) : '';
        const gpsLitersRaw = row[10] != null ? String(row[10]) : '';
        const gpsOld = gpsOldRaw !== '' ? parseFloat(gpsOldRaw) : null;
        const gpsNew = gpsNewRaw !== '' ? parseFloat(gpsNewRaw) : null;
        const gpsLiters = gpsLitersRaw !== '' ? parseFloat(gpsLitersRaw) : null;
        const unitPrice = parseFloat(String(row[12] ?? ''));
        const costFromCol14 = parseFloat(String(row[13] ?? ''));

        // Skip TC (summary) rows
        if (String(row[3]).trim() === 'TC') continue;
        if (!plateNum.match(/^\d{2}[A-Za-z]/)) continue;

        // Parse record date FIRST — used for month grouping
        let recordDate: string | null = null;
        if (dateVal instanceof Date) {
          recordDate = dateVal.toISOString().split('T')[0];
        } else if (typeof dateVal === 'number') {
          // Excel serial number - validate range (40000 = ~2009, 60000 = ~2064)
          if (dateVal >= 40000 && dateVal <= 60000) {
            const dateObj = new Date((dateVal - 25569) * 86400000);
            recordDate = dateObj.toISOString().split('T')[0];
          }
        } else {
          const dateStr = String(dateVal ?? '').trim();
          if (dateStr) {
            // Try DD/MM/YYYY or DD-MM-YYYY format (common in Vietnamese Excel)
            const ddmmyyyyMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
            if (ddmmyyyyMatch) {
              const day = ddmmyyyyMatch[1].padStart(2, '0');
              const month = ddmmyyyyMatch[2].padStart(2, '0');
              const year = ddmmyyyyMatch[3];
              recordDate = `${year}-${month}-${day}`;
            } else {
              const parsed = new Date(dateStr);
              if (!isNaN(parsed.getTime())) {
                recordDate = parsed.toISOString().split('T')[0];
              }
            }
          }
        }

        // If date is missing but row has valid data (cost > 0 or liters > 0), fallback to last valid date in sheet
        const hasValidFinancialData = (!isNaN(costFromCol14) && costFromCol14 > 0) || (!isNaN(liters) && liters > 0);
        if (!recordDate && hasValidFinancialData && lastValidDateInSheet) {
          recordDate = lastValidDateInSheet;
        }

        if (!recordDate) {
          continue; // Skip placeholder rows with no date and no data
        }

        // Validate final date is reasonable (2020-2030)
        if (recordDate < '2020-01-01' || recordDate > '2030-12-31') {
          continue;
        }

        lastValidDateInSheet = recordDate;

        const month = recordDate.substring(0, 7);
        monthSet.add(month);

        // Default missing numeric values to 0
        const odoOldVal = isNaN(odoOld) ? 0 : odoOld;
        const odoNewVal = isNaN(odoNew) ? 0 : odoNew;
        const litersVal = isNaN(liters) ? 0 : liters;
        const unitPriceVal = isNaN(unitPrice) ? 0 : unitPrice;

        // Sanitize GPS values: NaN → null
        const gpsOldSanitized = (gpsOld != null && !isNaN(gpsOld)) ? gpsOld : null;
        const gpsNewSanitized = (gpsNew != null && !isNaN(gpsNew)) ? gpsNew : null;
        const gpsLitersSanitized = (gpsLiters != null && !isNaN(gpsLiters)) ? gpsLiters : null;

        const normalizedPlate = plateNum.replace(/[-,\s.]/g, '').toUpperCase();
        let vehicleId = vehicleMap.get(normalizedPlate);

        // Auto-insert vehicle if not found
        if (!vehicleId) {
          const insertResult = await pool.query<{ id: number }>(
            `INSERT INTO vehicles (plate_number, driver_name, vehicle_type, status)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT DO NOTHING
             RETURNING id`,
            [normalizedPlate, 'Xe ngoài', 'Xe ngoài', 'active'],
          );
          if (insertResult.rows.length > 0) {
            vehicleId = insertResult.rows[0].id;
          } else {
            const retry = await pool.query<{ id: number }>(
              `SELECT id FROM vehicles WHERE plate_number = $1 AND status = 'active'`,
              [normalizedPlate],
            );
            if (retry.rows.length > 0) {
              vehicleId = retry.rows[0].id;
            } else {
              allErrors.push({
                row: rowNum,
                plate_number: plateNum,
                reason: `Không thể thêm xe "${plateNum}" vào danh mục`,
              });
              continue;
            }
          }
          vehicleMap.set(normalizedPlate, vehicleId);
        }

        const distance = odoNewVal - odoOldVal;
        const fuelRate = distance > 0 ? litersVal * 100 / distance : null;
        const gpsDist = (gpsOldSanitized != null && gpsNewSanitized != null) ? gpsNewSanitized - gpsOldSanitized : null;
        const gpsFR = (gpsDist != null && gpsDist > 0 && gpsLitersSanitized != null)
          ? gpsLitersSanitized * 100 / gpsDist : null;
        // totalCost: use column N value if present, else calculate
        const totalCostFromExcel = parseFloat(String(row[13] ?? ''));
        const totalCost = !isNaN(totalCostFromExcel) && totalCostFromExcel > 0
          ? totalCostFromExcel
          : litersVal * unitPriceVal;

        // Row data: [vehicleId, recordDate, odoOld, odoNew, distance, liters, fuelRate,
        //            gpsOld, gpsNew, gpsDist, gpsLiters, gpsFR,
        //            unitPrice, totalCost, location, userId]
        const rowData = [
          vehicleId, recordDate, odoOldVal, odoNewVal,
          distance, litersVal, fuelRate,
          gpsOldSanitized, gpsNewSanitized, gpsDist,
          gpsLitersSanitized, gpsFR,
          unitPriceVal, totalCost, currentLocation, userId,
        ];

        // Deduplicate: check (vehicle_id, record_date, odoOldVal, litersVal, costVal)
        const key = `${vehicleId}_${recordDate}_${odoOldVal}_${litersVal}_${totalCost}`;
        if (seenKeys.has(key)) {
          continue; // Skip duplicate
        }
        seenKeys.add(key);
        allRows.push(rowData);
      }
    }

    // Batch UPSERT — NO DELETE, use ON CONFLICT to update or insert
    if (allRows.length === 0) {
      return { imported: 0, skipped: 0, errors: allErrors.length, details: allErrors.length > 0 ? allErrors : undefined };
    }

    // Generate a compact batch ID from the months present + timestamp
    const monthsList = [...monthSet].sort();
    const monthPrefix = monthsList.length <= 3
      ? monthsList.join('_')
      : `${monthsList[0]}_to_${monthsList[monthsList.length - 1]}`;
    const batchId = `fuel_${monthPrefix}_${Date.now()}`.substring(0, 50);
    const BATCH_SIZE = 100;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
        const batch = allRows.slice(i, i + BATCH_SIZE);
        const placeholders: string[] = [];
        const flatParams: unknown[] = [];
        let idx = 0;

        for (const r of batch) {
          const base = idx * 17;
          placeholders.push(
            `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, $${base + 15}, $${base + 16}, $${base + 17})`,
          );
          flatParams.push(
            r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10], r[11], r[12], r[13], batchId, r[14], r[15],
          );
          idx++;
        }

        await client.query(
          `INSERT INTO fuel_records
           (vehicle_id, record_date, odometer_old, odometer_new, distance, liters, fuel_rate,
            gps_old, gps_new, gps_distance, gps_liters, gps_fuel_rate,
            unit_price, total_cost, batch_id, location, created_by)
           VALUES ${placeholders.join(', ')}
           ON CONFLICT (vehicle_id, record_date, odometer_old, liters, total_cost) DO UPDATE SET
            odometer_new = EXCLUDED.odometer_new,
            distance = EXCLUDED.distance,
            fuel_rate = EXCLUDED.fuel_rate,
            gps_old = EXCLUDED.gps_old,
            gps_new = EXCLUDED.gps_new,
            gps_distance = EXCLUDED.gps_distance,
            gps_liters = EXCLUDED.gps_liters,
            gps_fuel_rate = EXCLUDED.gps_fuel_rate,
            unit_price = EXCLUDED.unit_price,
            batch_id = EXCLUDED.batch_id,
            location = EXCLUDED.location,
            updated_at = NOW()`,
          flatParams,
        );
        totalImported += batch.length;
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return {
      imported: totalImported,
      skipped: 0,
      errors: allErrors.length,
      details: allErrors.length > 0 ? allErrors : undefined,
    };
  },

  // Image Management

  async getImages(recordId: number): Promise<FuelRecordImage[]> {
    const result = await pool.query<FuelRecordImage>(
      `SELECT id, fuel_record_id, filename, original_filename, file_path, file_size, mime_type, created_at
       FROM fuel_record_images
       WHERE fuel_record_id = $1
       ORDER BY created_at DESC`,
      [recordId],
    );
    return result.rows;
  },

  async addImage(
    recordId: number,
    file: { originalname: string; filename: string; path: string; size: number; mimetype: string },
  ): Promise<FuelRecordImage> {
    const result = await pool.query<FuelRecordImage>(
      `INSERT INTO fuel_record_images (fuel_record_id, filename, original_filename, file_path, file_size, mime_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, fuel_record_id, filename, original_filename, file_path, file_size, mime_type, created_at`,
      [recordId, file.filename, file.originalname, file.path, file.size, file.mimetype],
    );
    return result.rows[0];
  },

  async deleteImage(imageId: number): Promise<string> {
    const result = await pool.query<{ file_path: string }>(
      `DELETE FROM fuel_record_images WHERE id = $1 RETURNING file_path`,
      [imageId],
    );
    if (result.rows.length === 0) throw { code: 'NOT_FOUND' };
    return result.rows[0].file_path;
  },
};
