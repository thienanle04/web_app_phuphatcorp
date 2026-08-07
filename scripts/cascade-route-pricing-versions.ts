/**
 * Cascade absolute route_price_versions → later adjustment periods.
 * Chạy scripts/sql/cascade_route_pricing_versions.sql
 *
 * Prerequisites:
 *   1) seed-adjustment-periods.ts (periods)
 *   2) absolute versions (vd. seed-clf-f.ts)
 *
 * Run from repo root:
 *   npx tsx scripts/cascade-route-pricing-versions.ts
 *   # or: npm run cascade:route-pricing
 */
import fs from 'node:fs';
import path from 'node:path';
import { pool, root } from './pgPool';

const SQL_PATH = path.join(root, 'scripts/sql/cascade_route_pricing_versions.sql');

async function main(): Promise<void> {
  if (!fs.existsSync(SQL_PATH)) {
    throw new Error(`Missing SQL file: ${SQL_PATH}`);
  }
  const sql = fs.readFileSync(SQL_PATH, 'utf8');

  const before = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM route_price_versions`,
  );
  const beforeCount = Number(before.rows[0].cnt);

  const client = await pool.connect();
  try {
    // Capture RAISE NOTICE from DO block
    const notices: string[] = [];
    client.on('notice', (msg) => {
      if (msg.message) notices.push(msg.message);
    });

    await client.query(sql);

    for (const n of notices) console.log(`NOTICE: ${n}`);
  } finally {
    client.release();
  }

  const after = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM route_price_versions`,
  );
  const afterCount = Number(after.rows[0].cnt);
  console.log(
    `✅ cascade_route_pricing_versions done — versions ${beforeCount} → ${afterCount} (+${afterCount - beforeCount})`,
  );
  await pool.end();
}

main().catch((err) => {
  console.error('cascade_route_pricing_versions failed:', err);
  process.exitCode = 1;
});
