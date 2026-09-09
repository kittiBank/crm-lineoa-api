import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { LineService } from '../line/line.service';
import { StorageService } from '../storage/storage.service';
import {
  buildLineMessages,
  parseTemplateMessageBlocks,
} from './line-message.builder';
import {
  applyMergeTagsToMessageBlocks,
  buildMergeTagValues,
  messageBlocksHaveMergeTags,
} from '../templates/merge-tags';

const MULTICAST_BATCH_SIZE = 500;
const BROADCAST_MEDIA_TTL_SECONDS = 60 * 60 * 24;

@Injectable()
export class BroadcastDeliveryService {
  private readonly logger = new Logger(BroadcastDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lineService: LineService,
    private readonly storageService: StorageService,
  ) {}

  async deliverBroadcast(userId: string, broadcastId: string) {
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id: broadcastId, userId },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            messageType: true,
            messages: true,
            content: true,
          },
        },
      },
    });

    if (!broadcast) {
      throw new NotFoundException('Broadcast not found');
    }

    if (!broadcast.template) {
      throw new BadRequestException('Broadcast template not found');
    }

    const lineAccount = await this.prisma.lineAccount.findUnique({
      where: { userId },
    });

    if (!lineAccount) {
      throw new BadRequestException(
        'LINE account not configured. Please connect your LINE OA first.',
      );
    }

    const messageBlocks = await this.withAccessibleMediaUrls(
      parseTemplateMessageBlocks(
        broadcast.template.messages,
        broadcast.template.content,
      ),
    );
    const lineMessages = buildLineMessages(messageBlocks);

    if (lineMessages.length === 0) {
      throw new BadRequestException(
        'Template has no valid messages to send via LINE',
      );
    }

    const recipients = await this.getRecipients(
      lineAccount.id,
      broadcast.audienceType,
    );
    const messageCount = recipients.length;

    if (messageCount === 0) {
      return this.finalizeBroadcast(broadcastId, {
        messageCount: 0,
        successCount: 0,
        failureCount: 0,
        status: 'completed',
        logs: [],
      });
    }

    const client = this.lineService.createClient(
      lineAccount.channelAccessToken,
      lineAccount.channelSecret,
    );

    let successCount = 0;
    let failureCount = 0;
    let deliveredMessageUnits = 0;
    const logs: {
      broadcastId: string;
      lineUserId: string;
      status: string;
      errorMessage?: string;
    }[] = [];

    try {
      if (messageBlocksHaveMergeTags(messageBlocks)) {
        const personalized = await this.deliverPersonalizedBroadcast(
          client,
          broadcastId,
          messageBlocks,
          recipients,
        );
        successCount = personalized.successCount;
        failureCount = personalized.failureCount;
        deliveredMessageUnits = personalized.deliveredMessageUnits;
        logs.push(...personalized.logs);
      } else if (broadcast.audienceType === 'all') {
        await client.broadcast(lineMessages);
        successCount = messageCount;
        deliveredMessageUnits = successCount * lineMessages.length;

        for (const recipient of recipients) {
          logs.push({
            broadcastId,
            lineUserId: recipient.id,
            status: 'sent',
          });
        }
      } else {
        const lineUserIds = recipients.map((recipient) => recipient.lineUserId);

        for (let index = 0; index < lineUserIds.length; index += MULTICAST_BATCH_SIZE) {
          const batchIds = lineUserIds.slice(index, index + MULTICAST_BATCH_SIZE);
          const batchRecipients = recipients.slice(
            index,
            index + MULTICAST_BATCH_SIZE,
          );

          try {
            await client.multicast(batchIds, lineMessages);
            successCount += batchIds.length;
            deliveredMessageUnits += batchIds.length * lineMessages.length;

            for (const recipient of batchRecipients) {
              logs.push({
                broadcastId,
                lineUserId: recipient.id,
                status: 'sent',
              });
            }
          } catch (error) {
            const errorMessage = this.getErrorMessage(error);
            failureCount += batchIds.length;
            this.logger.error(
              `Failed to multicast broadcast ${broadcastId}: ${errorMessage}`,
            );

            for (const recipient of batchRecipients) {
              logs.push({
                broadcastId,
                lineUserId: recipient.id,
                status: 'failed',
                errorMessage,
              });
            }
          }
        }
      }
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(
        `Failed to send broadcast ${broadcastId}: ${errorMessage}`,
      );

      failureCount = messageCount;
      successCount = 0;
      deliveredMessageUnits = 0;

      for (const recipient of recipients) {
        logs.push({
          broadcastId,
          lineUserId: recipient.id,
          status: 'failed',
          errorMessage,
        });
      }
    }

    const status =
      successCount === 0 && failureCount > 0 ? 'failed' : 'completed';

    const finalizedBroadcast = await this.finalizeBroadcast(broadcastId, {
      messageCount,
      successCount,
      failureCount,
      status,
      logs,
    });

    if (successCount > 0) {
      try {
        await this.lineService.refreshMessageQuotaAfterBroadcast(
          userId,
          deliveredMessageUnits,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to refresh message quota after broadcast ${broadcastId}: ${this.getErrorMessage(error)}`,
        );
      }
    }

    return finalizedBroadcast;
  }

  private async getRecipients(lineAccountId: string, audienceType: string) {
    const now = new Date();
    const activeSince = new Date(now);
    activeSince.setDate(activeSince.getDate() - 30);
    const newSince = new Date(now);
    newSince.setDate(newSince.getDate() - 7);

    const where: {
      lineAccountId: string;
      status: string;
      lastActivity?: { gte: Date };
      followedAt?: { gte: Date };
    } = {
      lineAccountId,
      status: 'following',
    };

    if (audienceType === 'active') {
      where.lastActivity = { gte: activeSince };
    } else if (audienceType === 'new') {
      where.followedAt = { gte: newSince };
    }

    return this.prisma.lineUser.findMany({
      where,
      select: {
        id: true,
        lineUserId: true,
        displayName: true,
        pictureUrl: true,
        userType: true,
        userTier: true,
        phone: true,
      },
    });
  }

  private async deliverPersonalizedBroadcast(
    client: ReturnType<LineService['createClient']>,
    broadcastId: string,
    messageBlocks: ReturnType<typeof parseTemplateMessageBlocks>,
    recipients: Awaited<ReturnType<BroadcastDeliveryService['getRecipients']>>,
  ) {
    const PUSH_CONCURRENCY = 10;
    let successCount = 0;
    let failureCount = 0;
    let deliveredMessageUnits = 0;
    const logs: {
      broadcastId: string;
      lineUserId: string;
      status: string;
      errorMessage?: string;
    }[] = [];

    for (let index = 0; index < recipients.length; index += PUSH_CONCURRENCY) {
      const batch = recipients.slice(index, index + PUSH_CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (recipient) => {
          const messages = buildLineMessages(
            applyMergeTagsToMessageBlocks(
              messageBlocks,
              buildMergeTagValues(recipient),
            ),
          );

          if (messages.length === 0) {
            throw new Error('Template has no valid messages after merge tags');
          }

          await client.pushMessage(recipient.lineUserId, messages);
          return messages.length;
        }),
      );

      results.forEach((result, resultIndex) => {
        const recipient = batch[resultIndex];
        if (!recipient) {
          return;
        }

        if (result.status === 'fulfilled') {
          successCount += 1;
          deliveredMessageUnits += result.value;
          logs.push({
            broadcastId,
            lineUserId: recipient.id,
            status: 'sent',
          });
          return;
        }

        const errorMessage = this.getErrorMessage(result.reason);
        failureCount += 1;
        this.logger.error(
          `Failed to push personalized broadcast ${broadcastId} to ${recipient.lineUserId}: ${errorMessage}`,
        );
        logs.push({
          broadcastId,
          lineUserId: recipient.id,
          status: 'failed',
          errorMessage,
        });
      });
    }

    return {
      successCount,
      failureCount,
      deliveredMessageUnits,
      logs,
    };
  }

  private async finalizeBroadcast(
    broadcastId: string,
    result: {
      messageCount: number;
      successCount: number;
      failureCount: number;
      status: string;
      logs: {
        broadcastId: string;
        lineUserId: string;
        status: string;
        errorMessage?: string;
      }[];
    },
  ) {
    if (result.logs.length > 0) {
      await this.prisma.broadcastLog.createMany({
        data: result.logs,
      });
    }

    const broadcast = await this.prisma.broadcast.update({
      where: { id: broadcastId },
      data: {
        status: result.status,
        messageCount: result.messageCount,
        successCount: result.successCount,
        failureCount: result.failureCount,
        sentAt: new Date(),
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            messageType: true,
          },
        },
      },
    });

    return broadcast;
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private async withAccessibleMediaUrls(
    messages: ReturnType<typeof parseTemplateMessageBlocks>,
  ) {
    return Promise.all(
      messages.map(async (message) => ({
        ...message,
        imageUrl: message.imageUrl
          ? await this.storageService.resolveAccessibleUrl(
              message.imageUrl,
              BROADCAST_MEDIA_TTL_SECONDS,
            )
          : message.imageUrl,
        previewImageUrl: message.previewImageUrl
          ? await this.storageService.resolveAccessibleUrl(
              message.previewImageUrl,
              BROADCAST_MEDIA_TTL_SECONDS,
            )
          : message.previewImageUrl,
        columns: message.columns
          ? await Promise.all(
              message.columns.map(async (column) => ({
                ...column,
                imageUrl: column.imageUrl
                  ? await this.storageService.resolveAccessibleUrl(
                      column.imageUrl,
                      BROADCAST_MEDIA_TTL_SECONDS,
                    )
                  : column.imageUrl,
              })),
            )
          : message.columns,
      })),
    );
  }
}
