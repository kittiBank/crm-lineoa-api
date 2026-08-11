import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { WinstonModule } from 'nest-winston';
import { PrismaModule } from '@/prisma/prisma.module';
import { workerWinstonConfig } from '@/config/winston.config';
import { QueueModule } from '@/queue/queue.module';
import { BroadcastDeliveryModule } from '../modules/campaigns/broadcast-delivery.module';
import { AutoMessagesModule } from '../modules/auto-messages/auto-messages.module';
import { BroadcastConsumerService } from './broadcast.consumer';
import { BroadcastSchedulerService } from './broadcast-scheduler.service';
import { AutoReplyConsumerService } from './auto-reply.consumer';
import { MetricsModule } from '@/common/metrics/metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MetricsModule,
    ScheduleModule.forRoot(),
    WinstonModule.forRoot(workerWinstonConfig),
    PrismaModule,
    QueueModule,
    BroadcastDeliveryModule,
    AutoMessagesModule,
  ],
  providers: [
    BroadcastConsumerService,
    BroadcastSchedulerService,
    AutoReplyConsumerService,
  ],
})
export class WorkerModule {}
