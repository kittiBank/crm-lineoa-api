import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { WinstonModule } from 'nest-winston';
import { PrismaModule } from '@/prisma/prisma.module';
import { winstonConfig } from '@/config/winston.config';
import { QueueModule } from '@/queue/queue.module';
import { BroadcastDeliveryModule } from '../modules/campaigns/broadcast-delivery.module';
import { AutoMessagesModule } from '../modules/auto-messages/auto-messages.module';
import { BroadcastConsumerService } from './broadcast.consumer';
import { BroadcastSchedulerService } from './broadcast-scheduler.service';
import { AutoReplyConsumerService } from './auto-reply.consumer';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    WinstonModule.forRoot(winstonConfig),
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
