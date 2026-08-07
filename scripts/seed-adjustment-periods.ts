/**
 * Seed Kỳ điều chỉnh — chạy scripts/sql/seed_adjustment_periods.sql
 *
 * Run from repo root:
 *   npx tsx scripts/seed-adjustment-periods.ts
 *   # or: npm run seed:adjustment-periods
 */
import fs from 'node:fs';
import path from 'node:path';
import { pool, root } from './pgPool';

const SQL_PATH = path.join(root, 'scripts/sql/seed_adjustment_periods.sql');

async function main(): Promise<void> {
  if (!fs.existsSync(SQL_PATH)) {
    throw new Error(`Missing SQL file: ${SQL_PATH}`);
  }
  const sql = fs.readFileSync(SQL_PATH, 'utf8');
  const client = await pool.connect();
  try {
    await client.query(sql);
    const { rows } = await client.query<{ cnt: string; open_cnt: string }>(
      `SELECT
         COUNT(*)::text AS cnt,
         COUNT(*) FILTER (WHERE end_date IS NULL)::text AS open_cnt
       FROM route_pricing_adjustment_periods`,
    );
    console.log(
      `✅ seed_adjustment_periods done — ${rows[0].cnt} period(s), open=${rows[0].open_cnt}`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('seed_adjustment_periods failed:', err);
  process.exitCode = 1;
});
