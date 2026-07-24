import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { ChannelWrapper } from 'amqp-connection-manager';
import { PrismaService } from '@/prisma/prisma.service';
import { BroadcastDeliveryService } from '../modules/campaigns/broadcast-delivery.service';
import {
  BROADCAST_SEND_QUEUE,
  BroadcastQueueMessage,
} from '../queue/queue.constants';

type AmqpChannel = {
  assertQueue(queue: string, options?: { durable?: boolean }): Promise<void>;
  prefetch(count: number): Promise<void>;
  consume(
    queue: string,
    onMessage: (message: AmqpMessage | null) => void,
  ): Promise<void>;
  ack(message: AmqpMessage): void;
};

type AmqpMessage = {
  content: Buffer;
};

@Injectable()
export class BroadcastConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BroadcastConsumerService.name);
  private connection: ReturnType<typeof amqp.connect> | null = null;
  private channelWrapper: ChannelWrapper | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly broadcastDeliveryService: BroadcastDeliveryService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    const amqpUrl = this.configService.get<string>('AMQP_URL');
    if (!amqpUrl) {
      this.logger.error('AMQP_URL is not configured. Worker cannot start.');
      process.exit(1);
    }

    this.connection = amqp.connect([amqpUrl]);
    this.channelWrapper = this.connection.createChannel({
      json: false,
      setup: async (channel: AmqpChannel) => {
        await channel.assertQueue(BROADCAST_SEND_QUEUE, { durable: true });
        await channel.prefetch(1);
        await channel.consume(BROADCAST_SEND_QUEUE, (message) => {
          void this.handleMessage(channel, message);
        });
      },
    });

    this.logger.log(`Listening on queue "${BROADCAST_SEND_QUEUE}"`);
  }

  private async handleMessage(
    channel: AmqpChannel,
    message: AmqpMessage | null,
  ) {
    if (!message) {
      return;
    }

    let payload: BroadcastQueueMessage;

    try {
      payload = JSON.parse(message.content.toString()) as BroadcastQueueMessage;
    } catch (error) {
      this.logger.error('Invalid broadcast queue message payload', error);
      channel.ack(message);
      return;
    }

    try {
      await this.broadcastDeliveryService.deliverBroadcast(
        payload.userId,
        payload.broadcastId,
      );
      this.logger.log(`Processed broadcast ${payload.broadcastId}`);
      channel.ack(message);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to process broadcast ${payload.broadcastId}: ${errorMessage}`,
      );

      await this.markBroadcastFailed(payload.broadcastId);
      channel.ack(message);
    }
  }

  private async markBroadcastFailed(broadcastId: string) {
    try {
      await this.prisma.broadcast.update({
        where: { id: broadcastId },
        data: { status: 'failed' },
      });
    } catch (error) {
      this.logger.error(
        `Failed to mark broadcast ${broadcastId} as failed`,
        error,
      );
    }
  }

  async onModuleDestroy() {
    await this.channelWrapper?.close();
    await this.connection?.close();
  }
}
