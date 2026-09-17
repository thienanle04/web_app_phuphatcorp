import { Pool } from 'pg';
import { env } from './env';

export const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        max: 20,
        min: 2,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        options: '-c timezone=Asia/Ho_Chi_Minh',
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
      }
    : {
        host: env.db.host,
        port: env.db.port,
        database: env.db.database,
        user: env.db.user,
        password: env.db.password,
        ssl: env.db.ssl ? { rejectUnauthorized: false } : false,
        max: 20,
        min: 2,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        options: '-c timezone=Asia/Ho_Chi_Minh',
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
      },
);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});
