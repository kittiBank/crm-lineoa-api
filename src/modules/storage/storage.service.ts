import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: Minio.Client;
  private bucket: string;
  private publicUrl: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('MINIO_ENDPOINT', 'localhost');
    const port = Number(this.configService.get<string>('MINIO_PORT', '9000'));
    const useSSL = this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true';

    this.bucket = this.configService.get<string>('MINIO_BUCKET', 'crm-lineoa');
    this.publicUrl = this.configService.get<string>(
      'MINIO_PUBLIC_URL',
      `http://${endpoint}:${port}`,
    );

    this.client = new Minio.Client({
      endPoint: endpoint,
      port,
      useSSL,
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
    });
  }

  async onModuleInit() {
    try {
      await this.ensureBucketReady();
      this.logger.log(`MinIO connected — bucket "${this.bucket}" ready`);
    } catch (error) {
      this.logger.warn(
        `MinIO not available yet: ${error instanceof Error ? error.message : error}`,
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
    await this.ensureBucketReady();

    try {
      await this.client.putObject(this.bucket, key, buffer, buffer.length, {
        'Content-Type': contentType,
      });
    } catch (error) {
      this.logger.error(
        `Failed to upload "${key}" to MinIO: ${
          error instanceof Error ? error.message : error
        }`,
      );
      throw error;
    }

    const url = this.getPublicUrl(key);
    this.logger.log(`Uploaded to MinIO: ${url}`);

    return { key, url };
  }

  async delete(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }

  async getPresignedUrl(key: string, expirySeconds = 3600): Promise<string> {
    return this.client.presignedGetObject(this.bucket, key, expirySeconds);
  }

  getPublicUrl(key: string): string {
    return `${this.publicUrl}/${this.bucket}/${key}`;
  }

  buildKey(folder: string, filename: string): string {
    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${folder}/${Date.now()}-${sanitized}`;
  }
}
