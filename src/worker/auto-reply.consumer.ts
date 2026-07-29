import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { ChannelWrapper } from 'amqp-connection-manager';
import { AutoReplyService } from '../modules/auto-messages/auto-reply.service';
import {
  AUTO_REPLY_QUEUE,
  AutoReplyQueueMessage,
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
export class AutoReplyConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AutoReplyConsumerService.name);
  private connection: ReturnType<typeof amqp.connect> | null = null;
  private channelWrapper: ChannelWrapper | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly autoReplyService: AutoReplyService,
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
        await channel.assertQueue(AUTO_REPLY_QUEUE, { durable: true });
        await channel.prefetch(5);
        await channel.consume(AUTO_REPLY_QUEUE, (message) => {
          void this.handleMessage(channel, message);
        });
      },
    });

    this.logger.log(`Listening on queue "${AUTO_REPLY_QUEUE}"`);
  }

  private async handleMessage(
    channel: AmqpChannel,
    message: AmqpMessage | null,
  ) {
    if (!message) {
      return;
    }

    let payload: AutoReplyQueueMessage;

    try {
      payload = JSON.parse(message.content.toString()) as AutoReplyQueueMessage;
    } catch (error) {
      this.logger.error('Invalid auto-reply queue message payload', error);
      channel.ack(message);
      return;
    }

    try {
      await this.autoReplyService.processAutoReply(payload);
      channel.ack(message);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to process auto-reply for "${payload.matchInput}": ${errorMessage}`,
      );
      channel.ack(message);
    }
  }

  async onModuleDestroy() {
    await this.channelWrapper?.close();
    await this.connection?.close();
  }
}
