import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { pool } from '../config/database';

async function main() {
  const files = [
    '039_create_vn_provinces_wards.sql',
    '040_create_route_pricing.sql',
    '041_seed_route_pricing_permissions.sql',
    '042_route_pricing_adjustment_periods.sql',
    '044_route_pricing_price_books.sql',
  ];
  const executed = await pool.query<{ filename: string }>('SELECT filename FROM schema_migrations');
  const set = new Set(executed.rows.map((r) => r.filename));
  console.log('Already:', [...set].filter((f) => /^(03[3-9]|04[0-4])_/.test(f)).join(', ') || '(none 039–044)');

  for (const file of files) {
    if (set.has(file)) {
      console.log('Skip', file);
      continue;
    }
    const sql = fs.readFileSync(path.join(__dirname, '../migrations', file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log('OK', file);
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('FAIL', file, e);
      throw e;
    } finally {
      client.release();
    }
  }
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
