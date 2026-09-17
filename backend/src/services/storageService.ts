import * as Minio from 'minio';
import path from 'path';
import { env } from '../config/env';

let client: Minio.Client | null = null;

function getClient(): Minio.Client {
  if (!client) {
    client = new Minio.Client({
      endPoint: env.minio.endpoint,
      port: env.minio.port,
      useSSL: env.minio.useSSL,
      accessKey: env.minio.accessKey,
      secretKey: env.minio.secretKey,
      region: 'us-east-1',
      pathStyle: true,
    });
  }
  return client;
}

export interface UploadResult {
  filename: string;
  objectKey: string;
}

export const storageService = {
  async ensureBucket(bucket?: string): Promise<void> {
    const cl = getClient();
    const name = bucket ?? env.minio.bucket;
    const exists = await cl.bucketExists(name);
    if (!exists) {
      await cl.makeBucket(name);
      console.log(`[MinIO] Created bucket: ${name}`);
    }
  },

  async putObject(params: {
    bucket: string;
    objectKey: string;
    buffer: Buffer;
    mimetype: string;
  }): Promise<void> {
    const cl = getClient();
    await cl.putObject(params.bucket, params.objectKey, params.buffer, params.buffer.length, {
      'Content-Type': params.mimetype,
    });
  },

  async getObjectStream(
    bucket: string,
    objectKey: string,
  ): Promise<{ stream: NodeJS.ReadableStream; stat: Minio.BucketItemStat }> {
    const cl = getClient();
    const stat = await cl.statObject(bucket, objectKey);
    const stream = await cl.getObject(bucket, objectKey);
    return { stream, stat };
  },

  async deleteObject(bucket: string, objectKey: string): Promise<void> {
    const cl = getClient();
    try {
      await cl.removeObject(bucket, objectKey);
    } catch {
      // Missing object is fine (overwrite / delete race)
    }
  },

  async upload(buffer: Buffer, originalname: string, mimetype: string): Promise<UploadResult> {
    const cl = getClient();
    const ext = path.extname(originalname);
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

    await cl.putObject(env.minio.bucket, filename, buffer, buffer.length, {
      'Content-Type': mimetype,
    });

    return {
      filename,
      objectKey: `${env.minio.bucket}/${filename}`,
    };
  },

  async getStream(filename: string): Promise<{ stream: NodeJS.ReadableStream; stat: Minio.BucketItemStat }> {
    return this.getObjectStream(env.minio.bucket, filename);
  },

  async delete(filename: string): Promise<void> {
    await this.deleteObject(env.minio.bucket, filename);
  },

  async getPublicUrl(filename: string): Promise<string> {
    const cl = getClient();
    const url = await cl.presignedGetObject(env.minio.bucket, filename, 24 * 60 * 60);

    if (env.minio.publicUrl) {
      const pub = env.minio.publicUrl.replace(/\/$/, '');
      const urlObj = new URL(url);
      return `${pub}${urlObj.pathname}${urlObj.search}`;
    }

    return url;
  },
};
