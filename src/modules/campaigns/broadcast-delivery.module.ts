import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { LineModule } from '../line/line.module';
import { StorageModule } from '../storage/storage.module';
import { BroadcastDeliveryService } from './broadcast-delivery.service';

@Module({
  imports: [PrismaModule, LineModule, StorageModule],
  providers: [BroadcastDeliveryService],
  exports: [BroadcastDeliveryService],
})
export class BroadcastDeliveryModule {}
