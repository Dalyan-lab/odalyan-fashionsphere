import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

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

  /**
   * Enregistre un fichier. `keyPrefix` (ex: "shops/<id>") organise les fichiers
   * par boutique dans le bucket central.
   */
  async save(
    buffer: Buffer,
    filename: string,
    contentType: string,
    keyPrefix?: string,
  ): Promise<string> {
    const key = keyPrefix ? `${keyPrefix.replace(/\/$/, '')}/${filename}` : filename;

    if (this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET!,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );
      const base =
        process.env.S3_PUBLIC_URL ??
        (process.env.S3_ENDPOINT
          ? `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}`
          : `https://${process.env.S3_BUCKET}.s3.amazonaws.com`);
      return `${base.replace(/\/$/, '')}/${key}`;
    }

    // Disque local (dev) : on aplatit le préfixe dans le nom de fichier
    const dir = join(process.cwd(), 'uploads');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, filename), buffer);
    const base = process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
    return `${base}/uploads/${filename}`;
  }

  /** Espace utilisé (octets) sous un préfixe donné. 0 si stockage local. */
  async usedBytes(keyPrefix: string): Promise<number> {
    if (!this.s3) return 0;
    let total = 0;
    let token: string | undefined;
    try {
      do {
        const res = await this.s3.send(
          new ListObjectsV2Command({
            Bucket: process.env.S3_BUCKET!,
            Prefix: `${keyPrefix.replace(/\/$/, '')}/`,
            ContinuationToken: token,
          }),
        );
        for (const o of res.Contents ?? []) total += o.Size ?? 0;
        token = res.IsTruncated ? res.NextContinuationToken : undefined;
      } while (token);
    } catch (err) {
      this.logger.error(`Calcul du stockage échoué (${keyPrefix}): ${String(err)}`);
    }
    return total;
  }
}
