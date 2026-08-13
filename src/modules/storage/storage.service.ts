import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: Minio.Client;
  private bucket: string;
  private publicUrl: string;
  private autoCreateBucket: boolean;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>(
      'S3_ENDPOINT',
      'localhost',
    );
    const port = Number(this.configService.get<string>('S3_PORT', '9000'));
    const useSSL =
      this.configService.get<string>('S3_USE_SSL', 'false') === 'true';
    const region = this.configService.get<string>(
      'S3_REGION',
      'ap-southeast-1',
    );

    this.bucket = this.configService.get<string>(
      'S3_BUCKET',
      'crm-oa-storage',
    );
    this.publicUrl = this.configService
      .get<string>(
        'S3_PUBLIC_URL',
        `http://${endpoint}:${port}/${this.bucket}`,
      )
      .replace(/\/$/, '');
    this.autoCreateBucket =
      this.configService.get<string>('S3_AUTO_CREATE_BUCKET', 'false') ===
      'true';

    // AWS virtual-hosted public URLs need pathStyle=false so presigned URLs
    // match https://{bucket}.s3.{region}.amazonaws.com/...
    const useVirtualHostedStyle =
      this.publicUrl.includes(`${this.bucket}.s3.`) ||
      this.publicUrl.includes(`${this.bucket}.s3-`);

    this.client = new Minio.Client({
      endPoint: endpoint,
      port,
      useSSL,
      accessKey: this.configService.get<string>('S3_ACCESS_KEY', 'minioadmin'),
      secretKey: this.configService.get<string>('S3_SECRET_KEY', 'minioadmin'),
      region,
      pathStyle: !useVirtualHostedStyle,
    });
  }

  async onModuleInit() {
    try {
      if (this.autoCreateBucket) {
        await this.ensureBucketReady();
      } else {
        const exists = await this.client.bucketExists(this.bucket);
        if (!exists) {
          throw new Error(`Bucket "${this.bucket}" does not exist`);
        }
      }
      this.logger.log(`Object storage connected — bucket "${this.bucket}" ready`);
    } catch (error) {
      this.logger.warn(
        `Object storage not available yet: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }

  private async ensureBucketReady(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
      this.logger.log(`Created bucket: ${this.bucket}`);
    }
  }

  async upload(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<{ key: string; url: string }> {
    if (this.autoCreateBucket) {
      await this.ensureBucketReady();
    }

    try {
      await this.client.putObject(this.bucket, key, buffer, buffer.length, {
        'Content-Type': contentType,
      });
    } catch (error) {
      this.logger.error(
        `Failed to upload "${key}" to storage: ${
          error instanceof Error ? error.message : error
        }`,
      );
      throw error;
    }

    const url = this.getPublicUrl(key);
    this.logger.log(`Uploaded to storage: ${url}`);

    return { key, url };
  }

  async delete(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }

  async getPresignedUrl(key: string, expirySeconds = 3600): Promise<string> {
    return this.client.presignedGetObject(this.bucket, key, expirySeconds);
  }

  /**
   * Return a browser/LINE-accessible URL for a stored object URL.
   * Falls back to the original URL when it is not from our bucket.
   */
  async resolveAccessibleUrl(
    imageUrl: string,
    expirySeconds = 3600,
  ): Promise<string> {
    const key = this.extractKeyFromPublicUrl(imageUrl);
    if (!key) {
      return imageUrl;
    }

    try {
      return await this.getPresignedUrl(key, expirySeconds);
    } catch (error) {
      this.logger.warn(
        `Failed to presign "${key}": ${
          error instanceof Error ? error.message : error
        }`,
      );
      return imageUrl;
    }
  }

  /**
   * Normalize a (possibly presigned) storage URL back to the stable public URL.
   */
  toStablePublicUrl(imageUrl: string): string {
    const key = this.extractKeyFromPublicUrl(imageUrl);
    return key ? this.getPublicUrl(key) : imageUrl;
  }

  getPublicUrl(key: string): string {
    return `${this.publicUrl}/${key}`;
  }

  /**
   * Recover object key from a previously stored public or presigned URL.
   * Supports virtual-hosted (S3) and path-style (MinIO) URLs.
   */
  extractKeyFromPublicUrl(imageUrl: string | null | undefined): string | null {
    if (!imageUrl) {
      return null;
    }

    const normalized = imageUrl.trim().split('?')[0].split('#')[0];
    const publicPrefix = `${this.publicUrl}/`;
    if (normalized.startsWith(publicPrefix)) {
      return decodeURIComponent(normalized.slice(publicPrefix.length)) || null;
    }

    const pathStyleMarker = `/${this.bucket}/`;
    const markerIndex = normalized.indexOf(pathStyleMarker);
    if (markerIndex !== -1) {
      return (
        decodeURIComponent(
          normalized.slice(markerIndex + pathStyleMarker.length),
        ) || null
      );
    }

    try {
      const pathname = new URL(normalized).pathname.replace(/^\/+/, '');
      if (pathname.startsWith(`${this.bucket}/`)) {
        return decodeURIComponent(pathname.slice(this.bucket.length + 1)) || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  buildKey(folder: string, filename: string): string {
    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${folder}/${Date.now()}-${sanitized}`;
  }
}
