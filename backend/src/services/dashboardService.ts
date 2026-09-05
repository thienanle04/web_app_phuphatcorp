import { pool } from '../config/database';
import { oilChangeService } from './oilChangeService';
import { deliveryDataService } from './deliveryDataService';

export interface OverviewKpis {
  delivered_tons: number;
  invoice_count: number;
  trip_count: number;
  fuel_cost: number;
}

export interface MonthlyTons {
  month: string;
  tons: number;
  invoices: number;
}

export interface ExpiryAlert {
  vehicle_id: number;
  plate_number: string;
  expiry_date: string;
  days_left: number;
}

export interface OverviewAlerts {
  expired_inspections: number;
  due_inspections: ExpiryAlert[];
  expired_insurances: number;
  due_insurances: ExpiryAlert[];
  oil_overdue: number;
  oil_due_soon: number;
  unmatched_invoices: number;
}

export interface OverviewData {
  period: string;
  kpis: OverviewKpis;
  monthly_tons: MonthlyTons[];
  alerts: OverviewAlerts;
  dispatch_today: { xe_nho: number; xe_lon: number; tuyen_ngoai: number };
  last_reconcile: {
    status: string;
    started_at: string | null;
    scanned_count: number;
    matched_count: number;
  } | null;
}

export interface VehicleExpiryRow {
  vehicle_id: number;
  plate_number: string;
  driver_name: string;
  expiry_date: string | null;
  days_left: number | null;
  bucket: 'expired' | 'd30' | 'd60' | 'd90' | 'ok' | 'none';
}

export interface RepairCostRow {
  vehicle_id: number;
  plate_number: string;
  driver_name: string;
  repair_count: number;
  total_cost: number;
  last_repair_date: string | null;
}

export interface VehicleMaintenanceData {
  inspections: VehicleExpiryRow[];
  insurances: VehicleExpiryRow[];
  oil_changes: Awaited<ReturnType<typeof oilChangeService.getDueVehicles>>;
  repairs: RepairCostRow[];
}

export interface AccountingMonthRow {
  month: string;
  matched: number;
  unmatched: number;
}

export interface ReconcileLogRow {
  id: number;
  trigger_type: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  scanned_count: number;
  matched_count: number;
  error_message: string | null;
}

export interface AccountingData {
  totals: { matched: number; unmatched: number; total: number };
  by_month: AccountingMonthRow[];
  recent_batches: Awaited<ReturnType<typeof deliveryDataService.listBatches>>['data'];
  job_logs: ReconcileLogRow[];
}

export interface OperationsDailyRow {
  date: string;
  trips: number;
  tons: number;
}

export interface OperationsVehicleRow {
  so_xe: string;
  trips: number;
  tons: number;
}

export interface OperationsData {
  date_from: string;
  date_to: string;
  summary: { total_trips: number; total_tons: number; vehicle_count: number };
  daily: OperationsDailyRow[];
  by_vehicle: OperationsVehicleRow[];
  driver_invoices: { record_count: number; invoice_count: number };
}

export interface FuelMonthRow {
  month: string;
  liters: number;
  cost: number;
  distance: number;
  avg_fuel_rate: number | null;
}

export interface FuelVehicleRow {
  vehicle_id: number;
  plate_number: string;
  driver_name: string;
  liters: number;
  cost: number;
  distance: number;
  avg_fuel_rate: number | null;
  record_count: number;
}

export interface FuelDeviationRow {
  vehicle_id: number;
  plate_number: string;
  odometer_distance: number;
  gps_distance: number;
  diff: number;
  diff_pct: number | null;
  record_count: number;
}

export interface FuelDashboardData {
  summary: { liters: number; cost: number; distance: number; avg_fuel_rate: number | null };
  by_month: FuelMonthRow[];
  by_vehicle: FuelVehicleRow[];
  deviations: FuelDeviationRow[];
}

function periodStartDate(period: string): string {
  const now = new Date();
  if (period === 'quarter') {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    return new Date(now.getFullYear(), quarterStartMonth, 1).toISOString().slice(0, 10);
  }
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

async function getExpiryRows(table: 'inspection_records' | 'insurance_records'): Promise<VehicleExpiryRow[]> {
  const result = await pool.query(
    `WITH latest AS (
      SELECT DISTINCT ON (r.vehicle_id)
        r.vehicle_id,
        r.expiry_date
      FROM ${table} r
      WHERE r.status = 'active'
      ORDER BY r.vehicle_id, r.expiry_date DESC
    )
    SELECT
      v.id AS vehicle_id,
      v.plate_number,
      v.driver_name,
      l.expiry_date::text AS expiry_date,
      (l.expiry_date - CURRENT_DATE)::int AS days_left,
      CASE
        WHEN l.expiry_date IS NULL THEN 'none'
        WHEN l.expiry_date < CURRENT_DATE THEN 'expired'
        WHEN l.expiry_date <= CURRENT_DATE + 30 THEN 'd30'
        WHEN l.expiry_date <= CURRENT_DATE + 60 THEN 'd60'
        WHEN l.expiry_date <= CURRENT_DATE + 90 THEN 'd90'
        ELSE 'ok'
      END AS bucket
    FROM vehicles v
    LEFT JOIN latest l ON l.vehicle_id = v.id
    WHERE v.status = 'active'
    ORDER BY
      CASE WHEN l.expiry_date IS NULL THEN 1 ELSE 0 END,
      l.expiry_date ASC NULLS LAST,
      v.plate_number ASC`,
  );
  return result.rows;
}

const dashboardService = {
  async getOverview(period = 'month'): Promise<OverviewData> {
    const startDate = periodStartDate(period);

    const [kpiResult, monthlyResult, alertResult, dispatchResult, reconcileResult, oilDue] =
      await Promise.all([
        pool.query(
          `SELECT
            (SELECT COALESCE(SUM(hd_trong_luong), 0) / 1000.0
               FROM delivery_data WHERE ngay_hd >= $1::date) AS delivered_tons,
            (SELECT COUNT(DISTINCT so_hd)
               FROM delivery_data WHERE ngay_hd >= $1::date AND so_hd IS NOT NULL AND so_hd <> '') AS invoice_count,
            (SELECT COUNT(*)::int
               FROM delivery_schedules WHERE ngay >= $1::date) AS trip_count,
            (SELECT COALESCE(SUM(total_cost), 0)
               FROM fuel_records WHERE record_date >= $1::date) AS fuel_cost`,
          [startDate],
        ),
        pool.query(
          `WITH months AS (
            SELECT to_char(d.month_start, 'YYYY-MM') AS month
            FROM generate_series(
              date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
              date_trunc('month', CURRENT_DATE),
              INTERVAL '1 month'
            ) d(month_start)
          )
          SELECT
            m.month,
            COALESCE(SUM(dd.hd_trong_luong), 0) / 1000.0 AS tons,
            COUNT(DISTINCT NULLIF(dd.so_hd, ''))::int AS invoices
          FROM months m
          LEFT JOIN delivery_data dd ON to_char(dd.ngay_hd, 'YYYY-MM') = m.month
          GROUP BY m.month
          ORDER BY m.month`,
        ),
        pool.query(
          `SELECT
            (SELECT COUNT(*)::int FROM inspection_records r
              JOIN vehicles v ON v.id = r.vehicle_id AND v.status = 'active'
              WHERE r.status = 'active' AND r.expiry_date < CURRENT_DATE
                AND r.expiry_date = (
                  SELECT MAX(r2.expiry_date) FROM inspection_records r2
                  WHERE r2.vehicle_id = r.vehicle_id AND r2.status = 'active'
                )) AS expired_inspections,
            (SELECT COUNT(*)::int FROM insurance_records r
              JOIN vehicles v ON v.id = r.vehicle_id AND v.status = 'active'
              WHERE r.status = 'active' AND r.expiry_date < CURRENT_DATE
                AND r.expiry_date = (
                  SELECT MAX(r2.expiry_date) FROM insurance_records r2
                  WHERE r2.vehicle_id = r.vehicle_id AND r2.status = 'active'
                )) AS expired_insurances,
            (SELECT COUNT(*)::int FROM accountant_invoices WHERE trang_thai = 'không có') AS unmatched_invoices`,
        ),
        pool.query(
          `SELECT
            COUNT(*) FILTER (WHERE loai_xe = 'Xe nhỏ' AND loai_tuyen = 'Tuyến cố định')::int AS xe_nho,
            COUNT(*) FILTER (WHERE loai_xe = 'Xe lớn' AND loai_tuyen = 'Tuyến cố định')::int AS xe_lon,
            COUNT(*) FILTER (WHERE loai_tuyen = 'Tuyến ngoài')::int AS tuyen_ngoai
          FROM dispatch_schedules
          WHERE ngay = CURRENT_DATE`,
        ),
        pool.query(
          `SELECT status, started_at::text, scanned_count, matched_count
           FROM reconcile_job_logs
           ORDER BY started_at DESC
           LIMIT 1`,
        ),
        oilChangeService.getDueVehicles(),
      ]);

    const dueInspectionResult = await pool.query(
      `WITH latest AS (
        SELECT DISTINCT ON (r.vehicle_id) r.vehicle_id, r.expiry_date
        FROM inspection_records r
        WHERE r.status = 'active'
        ORDER BY r.vehicle_id, r.expiry_date DESC
      )
      SELECT v.id AS vehicle_id, v.plate_number, l.expiry_date::text,
             (l.expiry_date - CURRENT_DATE)::int AS days_left
      FROM latest l
      JOIN vehicles v ON v.id = l.vehicle_id AND v.status = 'active'
      WHERE l.expiry_date >= CURRENT_DATE AND l.expiry_date <= CURRENT_DATE + 90
      ORDER BY l.expiry_date ASC`,
    );
    const dueInsuranceResult = await pool.query(
      `WITH latest AS (
        SELECT DISTINCT ON (r.vehicle_id) r.vehicle_id, r.expiry_date
        FROM insurance_records r
        WHERE r.status = 'active'
        ORDER BY r.vehicle_id, r.expiry_date DESC
      )
      SELECT v.id AS vehicle_id, v.plate_number, l.expiry_date::text,
             (l.expiry_date - CURRENT_DATE)::int AS days_left
      FROM latest l
      JOIN vehicles v ON v.id = l.vehicle_id AND v.status = 'active'
      WHERE l.expiry_date >= CURRENT_DATE AND l.expiry_date <= CURRENT_DATE + 90
      ORDER BY l.expiry_date ASC`,
    );

    const kpi = kpiResult.rows[0];
    const lastLog = reconcileResult.rows[0] ?? null;

    return {
      period,
      kpis: {
        delivered_tons: parseFloat(kpi.delivered_tons) || 0,
        invoice_count: parseInt(kpi.invoice_count, 10),
        trip_count: parseInt(kpi.trip_count, 10),
        fuel_cost: parseFloat(kpi.fuel_cost) || 0,
      },
      monthly_tons: monthlyResult.rows.map((r) => ({
        month: r.month,
        tons: Math.round((parseFloat(r.tons) || 0) * 100) / 100,
        invoices: parseInt(r.invoices, 10),
      })),
      alerts: {
        expired_inspections: parseInt(alertResult.rows[0].expired_inspections, 10),
        due_inspections: dueInspectionResult.rows,
        expired_insurances: parseInt(alertResult.rows[0].expired_insurances, 10),
        due_insurances: dueInsuranceResult.rows,
        oil_overdue: oilDue.filter((v) => v.status === 'overdue').length,
        oil_due_soon: oilDue.filter((v) => v.status === 'due_soon').length,
        unmatched_invoices: parseInt(alertResult.rows[0].unmatched_invoices, 10),
      },
      dispatch_today: {
        xe_nho: dispatchResult.rows[0].xe_nho,
        xe_lon: dispatchResult.rows[0].xe_lon,
        tuyen_ngoai: dispatchResult.rows[0].tuyen_ngoai,
      },
      last_reconcile: lastLog
        ? {
            status: lastLog.status,
            started_at: lastLog.started_at,
            scanned_count: lastLog.scanned_count,
            matched_count: lastLog.matched_count,
          }
        : null,
    };
  },

  async getVehicleMaintenance(): Promise<VehicleMaintenanceData> {
    const [inspections, insurances, oilChanges, repairResult] = await Promise.all([
      getExpiryRows('inspection_records'),
      getExpiryRows('insurance_records'),
      oilChangeService.getDueVehicles(),
      pool.query(
        `SELECT
          v.id AS vehicle_id,
          v.plate_number,
          v.driver_name,
          COUNT(rr.id)::int AS repair_count,
          COALESCE(SUM(rr.total_amount), 0)::bigint AS total_cost,
          MAX(rr.repair_date)::text AS last_repair_date
        FROM vehicles v
        LEFT JOIN repair_records rr ON rr.vehicle_id = v.id AND rr.status = 'active'
          AND rr.repair_date >= CURRENT_DATE - INTERVAL '12 months'
        WHERE v.status = 'active'
        GROUP BY v.id, v.plate_number, v.driver_name
        HAVING COUNT(rr.id) > 0
        ORDER BY total_cost DESC`,
      ),
    ]);

    return {
      inspections,
      insurances,
      oil_changes: oilChanges,
      repairs: repairResult.rows.map((r) => ({
        vehicle_id: r.vehicle_id,
        plate_number: r.plate_number,
        driver_name: r.driver_name,
        repair_count: parseInt(r.repair_count, 10),
        total_cost: parseInt(r.total_cost, 10),
        last_repair_date: r.last_repair_date,
      })),
    };
  },

  async getAccounting(): Promise<AccountingData> {
    const [totalResult, byMonthResult, batches, logResult] = await Promise.all([
      pool.query(
        `SELECT
          COUNT(*) FILTER (WHERE trang_thai = 'đã có')::int AS matched,
          COUNT(*) FILTER (WHERE trang_thai = 'không có')::int AS unmatched,
          COUNT(*)::int AS total
        FROM accountant_invoices`,
      ),
      pool.query(
        `WITH months AS (
          SELECT to_char(d.month_start, 'YYYY-MM') AS month
          FROM generate_series(
            date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
            date_trunc('month', CURRENT_DATE),
            INTERVAL '1 month'
          ) d(month_start)
        )
        SELECT
          m.month,
          COUNT(*) FILTER (WHERE ai.trang_thai = 'đã có')::int AS matched,
          COUNT(*) FILTER (WHERE ai.trang_thai = 'không có')::int AS unmatched
        FROM months m
        LEFT JOIN accountant_invoices ai ON to_char(ai.ngay, 'YYYY-MM') = m.month
        GROUP BY m.month
        ORDER BY m.month`,
      ),
      deliveryDataService.listBatches(1, 8),
      pool.query(
        `SELECT id, trigger_type, status, started_at::text, finished_at::text,
                scanned_count, matched_count, error_message
        FROM reconcile_job_logs
        ORDER BY started_at DESC
        LIMIT 10`,
      ),
    ]);

    return {
      totals: totalResult.rows[0],
      by_month: byMonthResult.rows,
      recent_batches: batches.data,
      job_logs: logResult.rows,
    };
  },

  async getOperations(dateFrom?: string, dateTo?: string): Promise<OperationsData> {
    const to = dateTo || new Date().toISOString().slice(0, 10);
    const from =
      dateFrom ||
      new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [summaryResult, dailyResult, byVehicleResult, driverInvoiceResult] = await Promise.all([
      pool.query(
        `SELECT
          COUNT(*)::int AS total_trips,
          COALESCE(SUM(tan), 0) AS total_tons,
          COUNT(DISTINCT so_xe)::int AS vehicle_count
        FROM delivery_schedules
        WHERE ngay >= $1::date AND ngay <= $2::date`,
        [from, to],
      ),
      pool.query(
        `WITH days AS (
          SELECT d.day::date AS date
          FROM generate_series($1::date, $2::date, INTERVAL '1 day') d(day)
        )
        SELECT
          to_char(days.date, 'DD/MM') AS date,
          COUNT(ds.id)::int AS trips,
          COALESCE(SUM(ds.tan), 0) AS tons
        FROM days
        LEFT JOIN delivery_schedules ds ON ds.ngay = days.date
        GROUP BY days.date
        ORDER BY days.date`,
        [from, to],
      ),
      pool.query(
        `SELECT
          so_xe,
          COUNT(*)::int AS trips,
          COALESCE(SUM(tan), 0) AS tons
        FROM delivery_schedules
        WHERE ngay >= $1::date AND ngay <= $2::date
          AND so_xe IS NOT NULL AND so_xe <> ''
        GROUP BY so_xe
        ORDER BY trips DESC, so_xe ASC`,
        [from, to],
      ),
      pool.query(
        `SELECT
          COUNT(*)::int AS record_count,
          COALESCE(SUM(jsonb_array_length(so_hoa_don)), 0)::int AS invoice_count
        FROM driver_invoices
        WHERE ngay >= $1::date AND ngay <= $2::date`,
        [from, to],
      ),
    ]);

    return {
      date_from: from,
      date_to: to,
      summary: {
        total_trips: summaryResult.rows[0].total_trips,
        total_tons: parseFloat(summaryResult.rows[0].total_tons) || 0,
        vehicle_count: summaryResult.rows[0].vehicle_count,
      },
      daily: dailyResult.rows.map((r) => ({
        date: r.date,
        trips: r.trips,
        tons: parseFloat(r.tons) || 0,
      })),
      by_vehicle: byVehicleResult.rows.map((r) => ({
        so_xe: r.so_xe,
        trips: r.trips,
        tons: parseFloat(r.tons) || 0,
      })),
      driver_invoices: driverInvoiceResult.rows[0],
    };
  },

  async getFuel(): Promise<FuelDashboardData> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    const fromDate = sixMonthsAgo.toISOString().slice(0, 10);

    const [summaryResult, byMonthResult, byVehicleResult, deviationResult] = await Promise.all([
      pool.query(
        `SELECT
          COALESCE(SUM(liters), 0) AS liters,
          COALESCE(SUM(total_cost), 0) AS cost,
          COALESCE(SUM(distance), 0) AS distance,
          CASE WHEN SUM(distance) > 0 THEN SUM(liters) * 100.0 / SUM(distance) ELSE NULL END AS avg_fuel_rate
        FROM fuel_records
        WHERE record_date >= $1::date`,
        [fromDate],
      ),
      pool.query(
        `WITH months AS (
          SELECT to_char(d.month_start, 'YYYY-MM') AS month
          FROM generate_series(
            date_trunc('month', $1::date),
            date_trunc('month', CURRENT_DATE),
            INTERVAL '1 month'
          ) d(month_start)
        )
        SELECT
          m.month,
          COALESCE(SUM(fr.liters), 0) AS liters,
          COALESCE(SUM(fr.total_cost), 0) AS cost,
          COALESCE(SUM(fr.distance), 0) AS distance,
          CASE WHEN SUM(fr.distance) > 0 THEN SUM(fr.liters) * 100.0 / SUM(fr.distance) ELSE NULL END AS avg_fuel_rate
        FROM months m
        LEFT JOIN fuel_records fr ON to_char(fr.record_date, 'YYYY-MM') = m.month
        GROUP BY m.month
        ORDER BY m.month`,
        [fromDate],
      ),
      pool.query(
        `SELECT
          v.id AS vehicle_id,
          v.plate_number,
          v.driver_name,
          COALESCE(SUM(fr.liters), 0) AS liters,
          COALESCE(SUM(fr.total_cost), 0) AS cost,
          COALESCE(SUM(fr.distance), 0) AS distance,
          CASE WHEN SUM(fr.distance) > 0 THEN SUM(fr.liters) * 100.0 / SUM(fr.distance) ELSE NULL END AS avg_fuel_rate,
          COUNT(*)::int AS record_count
        FROM fuel_records fr
        JOIN vehicles v ON v.id = fr.vehicle_id
        WHERE fr.record_date >= $1::date
        GROUP BY v.id, v.plate_number, v.driver_name
        ORDER BY cost DESC`,
        [fromDate],
      ),
      pool.query(
        `SELECT
          v.id AS vehicle_id,
          v.plate_number,
          COALESCE(SUM(fr.distance), 0) AS odometer_distance,
          COALESCE(SUM(fr.gps_distance), 0) AS gps_distance,
          COALESCE(SUM(fr.distance), 0) - COALESCE(SUM(fr.gps_distance), 0) AS diff,
          CASE WHEN SUM(fr.gps_distance) > 0
            THEN (SUM(fr.distance) - SUM(fr.gps_distance)) * 100.0 / SUM(fr.gps_distance)
            ELSE NULL END AS diff_pct,
          COUNT(*)::int AS record_count
        FROM fuel_records fr
        JOIN vehicles v ON v.id = fr.vehicle_id
        WHERE fr.record_date >= $1::date AND fr.gps_distance IS NOT NULL
        GROUP BY v.id, v.plate_number
        HAVING ABS(COALESCE(SUM(fr.distance), 0) - COALESCE(SUM(fr.gps_distance), 0)) > 0
        ORDER BY ABS(COALESCE(SUM(fr.distance), 0) - COALESCE(SUM(fr.gps_distance), 0)) DESC
        LIMIT 20`,
        [fromDate],
      ),
    ]);

    return {
      summary: {
        liters: parseFloat(summaryResult.rows[0].liters) || 0,
        cost: parseFloat(summaryResult.rows[0].cost) || 0,
        distance: parseFloat(summaryResult.rows[0].distance) || 0,
        avg_fuel_rate: summaryResult.rows[0].avg_fuel_rate
          ? parseFloat(summaryResult.rows[0].avg_fuel_rate)
          : null,
      },
      by_month: byMonthResult.rows.map((r) => ({
        month: r.month,
        liters: parseFloat(r.liters) || 0,
        cost: parseFloat(r.cost) || 0,
        distance: parseFloat(r.distance) || 0,
        avg_fuel_rate: r.avg_fuel_rate ? parseFloat(r.avg_fuel_rate) : null,
      })),
      by_vehicle: byVehicleResult.rows.map((r) => ({
        vehicle_id: r.vehicle_id,
        plate_number: r.plate_number,
        driver_name: r.driver_name,
        liters: parseFloat(r.liters) || 0,
        cost: parseFloat(r.cost) || 0,
        distance: parseFloat(r.distance) || 0,
        avg_fuel_rate: r.avg_fuel_rate ? parseFloat(r.avg_fuel_rate) : null,
        record_count: parseInt(r.record_count, 10),
      })),
      deviations: deviationResult.rows.map((r) => ({
        vehicle_id: r.vehicle_id,
        plate_number: r.plate_number,
        odometer_distance: parseFloat(r.odometer_distance) || 0,
        gps_distance: parseFloat(r.gps_distance) || 0,
        diff: parseFloat(r.diff) || 0,
        diff_pct: r.diff_pct ? parseFloat(r.diff_pct) : null,
        record_count: parseInt(r.record_count, 10),
      })),
    };
  },
};

export default dashboardService;
