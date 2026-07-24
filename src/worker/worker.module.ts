import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { PrismaModule } from '@/prisma/prisma.module';
import { winstonConfig } from '@/config/winston.config';
import { BroadcastDeliveryModule } from '../modules/campaigns/broadcast-delivery.module';
import { BroadcastConsumerService } from './broadcast.consumer';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    WinstonModule.forRoot(winstonConfig),
    PrismaModule,
    BroadcastDeliveryModule,
  ],
  providers: [BroadcastConsumerService],
})
export class WorkerModule {}
