import { utilities as nestWinstonUtilities, WinstonModuleOptions } from 'nest-winston';
import * as fs from 'fs';
import * as path from 'path';
import * as winston from 'winston';
import { LokiTransport } from './loki.transport';

const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');
const obsLogDir = process.env.OBS_LOG_DIR?.trim();
const obsLokiUrl = process.env.OBS_LOKI_URL?.trim();

type WinstonServiceOptions = {
  service: 'api' | 'worker';
  logFileName: string;
  consoleAppName?: string;
};

export function createWinstonConfig(
  options: WinstonServiceOptions,
): WinstonModuleOptions {
  const devFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    nestWinstonUtilities.format.nestLike(
      options.consoleAppName ?? 'CRM-LINEOA',
      {
        colors: true,
        prettyPrint: true,
      },
    ),
  );

  const prodFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  );

  const transports: winston.transport[] = [
    new winston.transports.Console({
      format: isProduction ? prodFormat : devFormat,
    }),
  ];

  if (obsLogDir) {
    fs.mkdirSync(obsLogDir, { recursive: true });
    transports.push(
      new winston.transports.File({
        filename: path.join(obsLogDir, options.logFileName),
        format: prodFormat,
        maxsize: 10 * 1024 * 1024,
        maxFiles: 3,
      }),
    );
  }

  if (obsLokiUrl) {
    transports.push(new LokiTransport(obsLokiUrl, options.service));
  }

  return {
    level: logLevel,
    transports,
  };
}

export const winstonConfig = createWinstonConfig({
  service: 'api',
  logFileName: 'api.log',
  consoleAppName: 'CRM-LINEOA',
});

export const workerWinstonConfig = createWinstonConfig({
  service: 'worker',
  logFileName: 'worker.log',
  consoleAppName: 'CRM-WORKER',
});
