import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  buildLineMessages,
  parseTemplateMessageBlocks,
} from '../campaigns/line-message.builder';
import { LineService } from '../line/line.service';
import { AutoReplyQueueMessage } from '@/queue/queue.constants';

@Injectable()
export class AutoReplyService {
  private readonly logger = new Logger(AutoReplyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lineService: LineService,
  ) {}

  async processAutoReply(payload: AutoReplyQueueMessage): Promise<void> {
    const match = await this.findMatchingRule(
      payload.userId,
      payload.matchInput,
    );

    if (!match) {
      this.logger.log(
        `No auto message matched input "${payload.matchInput}" for user ${payload.userId}`,
      );
      return;
    }

    if (!match.template) {
      this.logger.warn(
        `Auto message ${match.id} has no template; skipping reply`,
      );
      return;
    }

    const lineAccount = await this.prisma.lineAccount.findUnique({
      where: { id: payload.lineAccountId },
    });

    if (!lineAccount) {
      this.logger.warn(
        `LINE account ${payload.lineAccountId} not found; skipping reply`,
      );
      return;
    }

    const messageBlocks = parseTemplateMessageBlocks(
      match.template.messages,
      match.template.content,
    );
    const lineMessages = buildLineMessages(messageBlocks);

    if (lineMessages.length === 0) {
      this.logger.warn(
        `Auto message ${match.id} template has no valid LINE messages`,
      );
      return;
    }

    const client = this.lineService.createClient(
      lineAccount.channelAccessToken,
      lineAccount.channelSecret,
    );

    try {
      if (payload.replyToken) {
        await client.replyMessage(payload.replyToken, lineMessages);
      } else {
        await client.pushMessage(payload.platformLineUserId, lineMessages);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Reply failed for auto message ${match.id} (${message}); falling back to push`,
      );

      await client.pushMessage(payload.platformLineUserId, lineMessages);
    }

    await this.prisma.autoMessage.update({
      where: { id: match.id },
      data: { triggerCount: { increment: 1 } },
    });

    this.logger.log(
      `Sent auto message ${match.id} for input "${payload.matchInput}"`,
    );
  }

  private async findMatchingRule(userId: string, matchInput: string) {
    const rules = await this.prisma.autoMessage.findMany({
      where: { userId, isActive: true },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      include: {
        template: {
          select: {
            id: true,
            name: true,
            messages: true,
            content: true,
            isActive: true,
          },
        },
      },
    });

    const normalizedData = matchInput.trim();

    return (
      rules.find((rule) => {
        if (!rule.template?.isActive) {
          return false;
        }

        const keyword = rule.keyword.trim();
        if (rule.matchType === 'contains') {
          return normalizedData
            .toLowerCase()
            .includes(keyword.toLowerCase());
        }

        return normalizedData === keyword;
      }) ?? null
    );
  }
}
