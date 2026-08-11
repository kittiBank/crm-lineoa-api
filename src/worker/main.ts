import { NestFactory } from '@nestjs/core';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { WorkerModule } from './worker.module';
import { startMetricsServer } from '@/common/metrics/metrics-server';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });

  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(logger);

  const metricsPort = Number(process.env.WORKER_METRICS_PORT || 9465);
  startMetricsServer(metricsPort);

  logger.log('Broadcast worker started', 'WorkerBootstrap');
}

bootstrap().catch((error) => {
  console.error('Failed to start broadcast worker', error);
  process.exit(1);
});
