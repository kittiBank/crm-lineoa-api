import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { LineModule } from '../line/line.module';
import { BroadcastDeliveryService } from './broadcast-delivery.service';

@Module({
  imports: [PrismaModule, LineModule],
  providers: [BroadcastDeliveryService],
  exports: [BroadcastDeliveryService],
})
export class BroadcastDeliveryModule {}
