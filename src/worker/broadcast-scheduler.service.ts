import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { BroadcastQueueService } from '@/queue/broadcast-queue.service';

@Injectable()
export class BroadcastSchedulerService {
  private readonly logger = new Logger(BroadcastSchedulerService.name);
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly broadcastQueueService: BroadcastQueueService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async pollScheduledBroadcasts() {
    if (this.processing) {
      return;
    }

    this.processing = true;

    try {
      const dueBroadcasts = await this.prisma.broadcast.findMany({
        where: {
          status: 'scheduled',
          scheduledFor: { lte: new Date() },
        },
        select: { id: true, userId: true },
      });

      if (dueBroadcasts.length === 0) {
        return;
      }

      this.logger.log(
        `Found ${dueBroadcasts.length} scheduled broadcast(s) due for sending`,
      );

      for (const broadcast of dueBroadcasts) {
        try {
          await this.prisma.broadcast.update({
            where: { id: broadcast.id, status: 'scheduled' },
            data: { status: 'processing', sentAt: new Date() },
          });

          await this.broadcastQueueService.enqueue({
            broadcastId: broadcast.id,
            userId: broadcast.userId,
          });

          this.logger.log(`Enqueued scheduled broadcast ${broadcast.id}`);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Failed to enqueue broadcast ${broadcast.id}: ${msg}`,
          );
        }
      }
    } finally {
      this.processing = false;
    }
  }
}
