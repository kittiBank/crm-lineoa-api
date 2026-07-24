import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const logger = new Logger('WorkerBootstrap');
  await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['error', 'warn', 'log'],
  });
  logger.log('Broadcast worker started');
}

bootstrap().catch((error) => {
  console.error('Failed to start broadcast worker', error);
  process.exit(1);
});
