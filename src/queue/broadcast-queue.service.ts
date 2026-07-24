import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { ChannelWrapper } from 'amqp-connection-manager';
import {
  BROADCAST_SEND_QUEUE,
  BroadcastQueueMessage,
} from './queue.constants';

type AmqpChannel = {
  assertQueue(queue: string, options?: { durable?: boolean }): Promise<void>;
};

@Injectable()
export class BroadcastQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(BroadcastQueueService.name);
  private connection: ReturnType<typeof amqp.connect> | null = null;
  private channelWrapper: ChannelWrapper | null = null;

  constructor(private readonly configService: ConfigService) {
    const amqpUrl = this.configService.get<string>('AMQP_URL');
    if (!amqpUrl) {
      this.logger.warn(
        'AMQP_URL is not configured. Broadcast jobs cannot be queued.',
      );
      return;
    }

    this.connection = amqp.connect([amqpUrl]);
    this.channelWrapper = this.connection.createChannel({
      json: false,
      setup: async (channel: AmqpChannel) => {
        await channel.assertQueue(BROADCAST_SEND_QUEUE, { durable: true });
      },
    });
  }

  async enqueue(payload: BroadcastQueueMessage): Promise<void> {
    const amqpUrl = this.configService.get<string>('AMQP_URL');
    if (!amqpUrl || !this.channelWrapper) {
      throw new BadRequestException(
        'Broadcast queue is unavailable. Please configure AMQP_URL and start RabbitMQ.',
      );
    }

    await this.channelWrapper.sendToQueue(
      BROADCAST_SEND_QUEUE,
      Buffer.from(JSON.stringify(payload)),
    );

    this.logger.log(
      `Queued broadcast ${payload.broadcastId} for user ${payload.userId}`,
    );
  }

  async onModuleDestroy() {
    await this.channelWrapper?.close();
    await this.connection?.close();
  }
}
