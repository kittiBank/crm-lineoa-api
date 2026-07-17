import { utilities as nestWinstonUtilities, WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';

const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  nestWinstonUtilities.format.nestLike('CRM-LINEOA', {
    colors: true,
    prettyPrint: true,
  }),
);

const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

export const winstonConfig: WinstonModuleOptions = {
  level: logLevel,
  transports: [
    new winston.transports.Console({
      format: isProduction ? prodFormat : devFormat,
    }),
  ],
};
