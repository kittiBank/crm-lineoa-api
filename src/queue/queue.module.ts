import { Module } from '@nestjs/common';
import { BroadcastQueueService } from './broadcast-queue.service';

@Module({
  providers: [BroadcastQueueService],
  exports: [BroadcastQueueService],
})
export class QueueModule {}
