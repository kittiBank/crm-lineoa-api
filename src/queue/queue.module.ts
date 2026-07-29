import { Module } from '@nestjs/common';
import { BroadcastQueueService } from './broadcast-queue.service';
import { AutoReplyQueueService } from './auto-reply-queue.service';

@Module({
  providers: [BroadcastQueueService, AutoReplyQueueService],
  exports: [BroadcastQueueService, AutoReplyQueueService],
})
export class QueueModule {}
