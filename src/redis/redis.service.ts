import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private ready = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const url = this.configService.get<string>(
      'REDIS_URL',
      'redis://localhost:6379',
    );

    try {
      const client = new Redis(url, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        lazyConnect: true,
        retryStrategy: () => null,
      });

      client.on('error', (error) => {
        if (this.ready) {
          this.logger.warn(
            `Redis error: ${error instanceof Error ? error.message : error}`,
          );
        }
      });

      await client.connect();
      await client.ping();
      this.client = client;
      this.ready = true;
      this.logger.log('Redis connected');
    } catch (error) {
      this.ready = false;
      this.client = null;
      this.logger.warn(
        `Redis unavailable — cache disabled: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }

  async onModuleDestroy() {
    if (!this.client) {
      return;
    }

    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    } finally {
      this.client = null;
      this.ready = false;
    }
  }

  isReady(): boolean {
    return this.ready && this.client !== null;
  }

  async getJson<T>(key: string): Promise<T | null> {
    if (!this.isReady() || !this.client) {
      return null;
    }

    try {
      const raw = await this.client.get(key);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as T;
    } catch (error) {
      this.logger.warn(
        `Redis get failed (${key}): ${
          error instanceof Error ? error.message : error
        }`,
      );
      return null;
    }
  }

  async setJson(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<void> {
    if (!this.isReady() || !this.client) {
      return;
    }

    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      this.logger.warn(
        `Redis set failed (${key}): ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (!this.isReady() || !this.client || keys.length === 0) {
      return;
    }

    try {
      await this.client.del(...keys);
    } catch (error) {
      this.logger.warn(
        `Redis del failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
