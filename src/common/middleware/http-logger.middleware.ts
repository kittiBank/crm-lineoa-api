import { Injectable, NestMiddleware, Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { NextFunction, Request, Response } from 'express';
import { MetricsService } from '../metrics/metrics.service';

function normalizeRoute(url: string): string {
  const path = url.split('?')[0];
  return path
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      ':id',
    )
    .replace(/\/\d+/g, '/:id');
}

@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly metricsService: MetricsService,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const { method, originalUrl, ip } = req;
      const { statusCode } = res;
      const route = normalizeRoute(originalUrl);

      this.metricsService.recordHttpRequest(
        method,
        route,
        statusCode,
        duration,
      );

      this.logger.info(`${method} ${originalUrl} ${statusCode} ${duration}ms`, {
        context: 'HTTP',
        method,
        url: originalUrl,
        route,
        statusCode,
        duration,
        ip,
      });
    });

    next();
  }
}
