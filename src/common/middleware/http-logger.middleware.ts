import { Injectable, NestMiddleware, Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const { method, originalUrl, ip } = req;
      const { statusCode } = res;

      this.logger.info(`${method} ${originalUrl} ${statusCode} ${duration}ms`, {
        context: 'HTTP',
        method,
        url: originalUrl,
        statusCode,
        duration,
        ip,
      });
    });

    next();
  }
}
