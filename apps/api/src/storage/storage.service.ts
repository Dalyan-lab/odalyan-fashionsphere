import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

/**
 * Stockage de fichiers : S3/R2 si configuré, sinon disque local (servi sous /uploads).
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client | null;

  constructor() {
    if (process.env.S3_BUCKET && process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY) {
      this.s3 = new S3Client({
        region: process.env.S3_REGION ?? 'auto',
        endpoint: process.env.S3_ENDPOINT || undefined,
        forcePathStyle: Boolean(process.env.S3_ENDPOINT), // R2 / MinIO
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY,
          secretAccessKey: process.env.S3_SECRET_KEY,
        },
      });
    } else {
      this.s3 = null;
      this.logger.warn('S3 non configuré — stockage des fichiers sur le disque local.');
    }
  }

  get enabled(): boolean {
    return Boolean(this.s3);
  }

  async save(buffer: Buffer, filename: string, contentType: string): Promise<string> {
    if (this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET!,
          Key: filename,
          Body: buffer,
          ContentType: contentType,
        }),
      );
      const base =
        process.env.S3_PUBLIC_URL ??
        (process.env.S3_ENDPOINT
          ? `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}`
          : `https://${process.env.S3_BUCKET}.s3.amazonaws.com`);
      return `${base.replace(/\/$/, '')}/${filename}`;
    }

    // Disque local
    const dir = join(process.cwd(), 'uploads');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, filename), buffer);
    const base = process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
    return `${base}/uploads/${filename}`;
  }
}
