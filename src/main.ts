import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppModule } from './app.module';
import helmet from 'helmet';
import compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(logger);

  // CORS Configuration
  // FRONTEND_URL / CORS_ORIGINS must include the browser origin exactly
  // e.g. https://crm-web.vortex-dev.com (no trailing slash)
  const allowedOrigins = new Set<string>([
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
  ]);

  const addOrigin = (value?: string) => {
    if (!value?.trim()) return;
    try {
      allowedOrigins.add(new URL(value.trim()).origin);
    } catch {
      // ignore invalid URL
    }
  };

  addOrigin(process.env.FRONTEND_URL);

  // Comma-separated list, e.g. https://crm-web.vortex-dev.com,https://main.xxx.amplifyapp.com
  for (const origin of (process.env.CORS_ORIGINS || '').split(',')) {
    addOrigin(origin);
  }

  // LIFF endpoint may be served from a public tunnel / custom domain
  addOrigin(process.env.LIFF_ENDPOINT_URL);

  const originList = [...allowedOrigins];
  logger.log(`CORS allowed origins: ${originList.join(', ')}`, 'Bootstrap');

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Non-browser clients (curl, server-to-server) send no Origin
      if (!origin || originList.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    optionsSuccessStatus: 204,
  });

  // Security — allow cross-origin API responses for browser clients
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(compression());

  // Global prefix
  app.setGlobalPrefix(process.env.API_PREFIX || 'api/v1');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('CRM LINE OA API')
    .setDescription('CRM API for LINE Official Account')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(
    `Application is running on: http://localhost:${port}`,
    'Bootstrap',
  );
}

bootstrap().catch((err) => {
  console.error('Application failed to start', err);
  process.exit(1);
});
