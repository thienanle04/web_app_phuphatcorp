import 'dotenv/config';
import app from './app';
import { env } from './config/env';
import { pool } from './config/database';
import { schedulerService } from './services/schedulerService';
import { initLogCleanup, destroyLogCleanup } from './services/logCleanupService';
import { storageService } from './services/storageService';

async function main(): Promise<void> {
  try {
    const client = await pool.connect();
    console.log('[DB] Connected to PostgreSQL');
    client.release();
  } catch (err) {
    console.error('[DB] Failed to connect:', err);
    process.exit(1);
  }

  await schedulerService.init();
  initLogCleanup();

  await storageService.ensureBucket().catch((err) => {
    console.warn('[MinIO] Bucket init failed (uploads may not work):', err instanceof Error ? err.message : err);
  });
  await storageService.ensureBucket(env.minio.bangKeBucket).catch((err) => {
    console.warn('[MinIO] Bang-ke bucket init failed:', err instanceof Error ? err.message : err);
  });
  await storageService.ensureBucket(env.minio.ticketAttachmentsBucket).catch((err) => {
    console.warn('[MinIO] Ticket attachments bucket init failed:', err instanceof Error ? err.message : err);
  });

  app.listen(env.port, () => {
    console.log(`[Server] Running on http://localhost:${env.port}`);
  });
}

process.on('SIGTERM', () => {
  schedulerService.destroy();
  destroyLogCleanup();
  process.exit(0);
});

main().catch(console.error);
