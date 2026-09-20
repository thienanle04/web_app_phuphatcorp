import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: process.env.PORT || 5000,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5443', 10),
    database: process.env.DB_NAME || 'test_PhuPhatCorp',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  minio: {
    endpoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    bucket: process.env.MINIO_BUCKET || 'phuphatcorp-inspections',
    bangKeBucket: process.env.MINIO_BANG_KE_BUCKET || 'phuphatcorp-bang-ke-tho',
    ticketAttachmentsBucket:
      process.env.MINIO_BUCKET_TICKET_ATTACHEMENTS ||
      process.env.MINIO_BUCKET_TICKET_ATTACHMENTS ||
      process.env.MINIO_BUCKET ||
      'phuphatcorp-inspections',
    publicUrl: process.env.MINIO_PUBLIC_URL || process.env.MINIO_ENDPOINT
      ? `${process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http'}://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT || '9000'}`
      : '',
  },
};
