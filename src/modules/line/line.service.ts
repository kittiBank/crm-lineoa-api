import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LineAccountRepository } from './repositories/line-account.repository';
import * as line from '@line/bot-sdk';
import { PrismaService } from '../../prisma/prisma.service';
import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { QueryLineUsersDto } from './dto/query-line-users.dto';
import { UpsertLineAccountDto } from './dto/verify-line.dto';
import { AutoReplyQueueService } from '@/queue/auto-reply-queue.service';
import { LineOaInfo, LineOaInfoFields, StoredLineOaInfo } from './types/line-oa-info';

@Injectable()
export class LineService {
  private lineClient: line.Client;
  private logger = new Logger('LineService');

  constructor(
    private configService: ConfigService,
    private lineAccountRepository: LineAccountRepository,
    private prisma: PrismaService,
    private autoReplyQueueService: AutoReplyQueueService,
  ) {
    this.lineClient = new line.Client({
      channelAccessToken: this.configService.get<string>(
        'LINE_BOT_CHANNEL_ACCESS_TOKEN',
      ) || '',
      channelSecret: this.configService.get<string>(
        'LINE_BOT_CHANNEL_SECRET',
      ) || '',
    });
  }

  async handleWebhook(events: line.WebhookEvent[]) {
    const promises = events.map((event) => this.handleEvent(event));
    await Promise.all(promises).catch((error) => {
      this.logger.error('Error handling webhook events:', error);
    });
  }

  private async handleEvent(event: line.WebhookEvent): Promise<void> {
    try {
      switch (event.type) {
        case 'message':
          await this.handleMessageEvent(event as line.MessageEvent);
          break;
        case 'follow':
          await this.handleFollowEvent(event as line.FollowEvent);
          break;
        case 'unfollow':
          await this.handleUnfollowEvent(event as line.UnfollowEvent);
          break;
        case 'join':
          await this.handleJoinEvent(event as line.JoinEvent);
          break;
        case 'leave':
          await this.handleLeaveEvent(event as line.LeaveEvent);
          break;
        case 'postback':
          await this.handlePostbackEvent(event as line.PostbackEvent);
          break;
        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      this.logger.error(`Error handling ${event.type} event:`, error);
    }
  }

  private async handleMessageEvent(event: line.MessageEvent): Promise<void> {
    this.logger.log(`Message from ${event.source.userId}: ${JSON.stringify(event.message)}`);

    try {
      const platformLineUserId = event.source.userId as string;
      if (!platformLineUserId) {
        return;
      }

      const lineUser = await this.getOrCreateLineUser(platformLineUserId);

      if (lineUser) {
        await this.prisma.message.create({
          data: {
            lineUserId: lineUser.id,
            lineAccountId: lineUser.lineAccountId,
            message:
              (event.message as any).text || JSON.stringify(event.message),
            type: event.message.type,
          },
        });

        await this.prisma.lineUser.update({
          where: { id: lineUser.id },
          data: { lastActivity: new Date() },
        });
      }

      if (event.message.type !== 'text') {
        return;
      }

      const text = (event.message as line.TextEventMessage).text?.trim();
      if (!text) {
        return;
      }

      await this.enqueueAutoReply({
        platformLineUserId,
        matchInput: text,
        replyToken: event.replyToken,
        eventType: 'message',
        event,
        lineUser,
      });
    } catch (error) {
      this.logger.error('Error handling message event:', error);
    }
  }

  private async getDefaultLineAccount() {
    const lineAccount = await this.prisma.lineAccount.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!lineAccount) {
      this.logger.warn('No LINE account found in database');
      return null;
    }

    return lineAccount;
  }

  private async handleFollowEvent(event: line.FollowEvent): Promise<void> {
    this.logger.log(`User followed: ${event.source.userId}`);

    try {
      const lineUserId = event.source.userId as string;
      const lineAccount = await this.getDefaultLineAccount();

      if (!lineAccount) {
        return;
      }

      // Get user profile from LINE
      const userProfile = await this.getProfile(lineUserId);

      // Create or re-activate LINE user (e.g. after unblock)
      await this.prisma.lineUser.upsert({
        where: {
          lineAccountId_lineUserId: {
            lineAccountId: lineAccount.id,
            lineUserId,
          },
        },
        update: {
          status: 'following',
          followedAt: new Date(),
          displayName: userProfile.displayName,
          pictureUrl: userProfile.pictureUrl,
          lastActivity: new Date(),
        },
        create: {
          lineAccountId: lineAccount.id,
          lineUserId,
          displayName: userProfile.displayName,
          pictureUrl: userProfile.pictureUrl,
          status: 'following',
          followedAt: new Date(),
          lastActivity: new Date(),
        },
      });

      // Send welcome message
      const welcomeMessage: line.Message = {
        type: 'text',
        text: `สวัสดีต้อนรับค่ะ ${userProfile.displayName}! ขอบคุณที่ follow เรา เรายินดีที่จะให้บริการคุณ 🎉`,
      };

      await this.pushMessage(lineUserId, [welcomeMessage]);
    } catch (error) {
      this.logger.error('Error handling follow event:', error);
    }
  }

  private async handleUnfollowEvent(event: line.UnfollowEvent): Promise<void> {
    this.logger.log(`User unfollowed: ${event.source.userId}`);

    try {
      const platformLineUserId = event.source.userId as string;
      const lineAccount = await this.getDefaultLineAccount();

      if (!lineAccount) {
        return;
      }

      await this.revertLineUserToGuest(lineAccount, platformLineUserId, 'blocked');
    } catch (error) {
      this.logger.error('Error handling unfollow event:', error);
    }
  }

  /**
   * Reset member login when user unfollows or blocks the OA.
   * Clears OTP sessions so they must verify again after re-following.
   */
  private async revertLineUserToGuest(
    lineAccount: {
      id: string;
      channelAccessToken: string;
      channelSecret: string;
    },
    platformLineUserId: string,
    status: 'blocked',
  ): Promise<void> {
    const lineUser = await this.prisma.lineUser.findUnique({
      where: {
        lineAccountId_lineUserId: {
          lineAccountId: lineAccount.id,
          lineUserId: platformLineUserId,
        },
      },
    });

    if (!lineUser) {
      return;
    }

    const wasMember = lineUser.userType === 'Member';

    await this.prisma.$transaction([
      this.prisma.otpSession.deleteMany({
        where: { lineUserId: lineUser.id },
      }),
      this.prisma.lineUser.update({
        where: { id: lineUser.id },
        data: {
          status,
          userType: 'Guest',
          phone: null,
          phoneVerifiedAt: null,
        },
      }),
    ]);

    if (wasMember) {
      await this.unlinkMemberRichMenu(lineAccount, platformLineUserId);
    }

    this.logger.log(
      `User reverted to Guest: ${platformLineUserId} (status=${status})`,
    );
  }

  private async unlinkMemberRichMenu(
    lineAccount: {
      channelAccessToken: string;
      channelSecret: string;
    },
    platformLineUserId: string,
  ): Promise<void> {
    try {
      const client = new line.Client({
        channelAccessToken: lineAccount.channelAccessToken,
        channelSecret: lineAccount.channelSecret,
      });

      await client.unlinkRichMenuFromUser(platformLineUserId);
    } catch (error) {
      this.logger.warn(
        `Failed to unlink rich menu for ${platformLineUserId}: ${error instanceof Error ? error.message : error
        }`,
      );
    }
  }

  private getGroupOrRoomId(source: line.EventSource): string | undefined {
    if (source.type === 'group') return source.groupId;
    if (source.type === 'room') return source.roomId;
    return undefined;
  }

  private async handleJoinEvent(event: line.JoinEvent): Promise<void> {
    const groupOrRoom = this.getGroupOrRoomId(event.source);
    this.logger.log(`Bot joined group/room: ${groupOrRoom}`);

    try {
      if (!groupOrRoom) return;

      const message: line.Message = {
        type: 'text',
        text: 'สวัสดีค่ะ! ขอบคุณที่เชิญเรามาที่นี่ เรายินดีที่จะให้บริการ',
      };

      await this.pushMessage(groupOrRoom, [message]);
    } catch (error) {
      this.logger.error('Error handling join event:', error);
    }
  }

  private async handleLeaveEvent(event: line.LeaveEvent): Promise<void> {
    const groupOrRoom = this.getGroupOrRoomId(event.source);
    this.logger.log(`Bot left group/room: ${groupOrRoom}`);
    // No action needed, just log the event
  }

  private async handlePostbackEvent(event: line.PostbackEvent): Promise<void> {
    this.logger.log(`Postback event: ${event.postback.data}`);

    try {
      const platformLineUserId = event.source.userId as string;
      if (!platformLineUserId) {
        return;
      }

      const lineUser = await this.getOrCreateLineUser(platformLineUserId);

      await this.enqueueAutoReply({
        platformLineUserId,
        matchInput: event.postback.data,
        replyToken: event.replyToken,
        eventType: 'postback',
        event,
        lineUser,
      });
    } catch (error) {
      this.logger.error('Error handling postback event:', error);
    }
  }

  private async enqueueAutoReply(params: {
    platformLineUserId: string;
    matchInput: string;
    replyToken?: string;
    eventType: 'message' | 'postback';
    event: line.WebhookEvent;
    lineUser: { id: string; lineAccountId: string } | null;
  }) {
    const lineUser =
      params.lineUser ??
      (await this.getOrCreateLineUser(params.platformLineUserId));

    if (!lineUser) {
      this.logger.warn('Cannot queue auto-reply: LINE user/account not found');
      return;
    }

    const lineAccount = await this.prisma.lineAccount.findUnique({
      where: { id: lineUser.lineAccountId },
      select: { id: true, userId: true },
    });

    if (!lineAccount) {
      return;
    }

    await this.prisma.webhookEvent.create({
      data: {
        lineUserId: lineUser.id,
        eventType: params.eventType,
        eventData: params.event as unknown as Prisma.InputJsonValue,
      },
    });

    await this.autoReplyQueueService.enqueue({
      userId: lineAccount.userId,
      lineAccountId: lineAccount.id,
      platformLineUserId: params.platformLineUserId,
      matchInput: params.matchInput,
      replyToken: params.replyToken,
    });
  }

  private async handleBeaconEvent(event: line.BeaconEvent): Promise<void> {
    this.logger.log(
      `Beacon event from ${event.source.userId}: ${event.beacon.hwid}`,
    );

    try {
      const replyMessages: line.Message[] = [
        {
          type: 'text',
          text: 'ขอบคุณที่เข้ามายังตำแหน่งของเรา! 📍',
        },
      ];

      await this.replyMessage(event.replyToken, replyMessages);
    } catch (error) {
      this.logger.error('Error handling beacon event:', error);
    }
  }

  private async getOrCreateLineUser(lineUserId: string): Promise<any> {
    try {
      const userProfile = await this.getProfile(lineUserId);
      const lineAccount = await this.getDefaultLineAccount();

      if (!lineAccount) {
        return null;
      }

      return await this.prisma.lineUser.upsert({
        where: {
          lineAccountId_lineUserId: {
            lineAccountId: lineAccount.id,
            lineUserId: lineUserId,
          },
        },
        update: {
          status: 'following',
          displayName: userProfile.displayName,
          pictureUrl: userProfile.pictureUrl,
          lastActivity: new Date(),
        },
        create: {
          lineAccountId: lineAccount.id,
          lineUserId: lineUserId,
          displayName: userProfile.displayName,
          pictureUrl: userProfile.pictureUrl,
          status: 'following',
          followedAt: new Date(),
          lastActivity: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Error getting or creating line user:', error);
      return null;
    }
  }

  async replyMessage(
    replyToken: string,
    messages: line.Message[],
  ): Promise<void> {
    await this.lineClient.replyMessage(replyToken, messages);
  }

  async pushMessage(userId: string, messages: line.Message[]): Promise<void> {
    await this.lineClient.pushMessage(userId, messages);
  }

  createClient(channelAccessToken: string, channelSecret: string): line.Client {
    return new line.Client({
      channelAccessToken,
      channelSecret,
    });
  }

  async getProfile(userId: string): Promise<line.Profile> {
    return await this.lineClient.getProfile(userId);
  }

  async verifyConnection(
    channelAccessToken: string,
    channelSecret: string,
    options?: { lineAccountId?: string },
  ): Promise<{
    status: string;
    botUserId: string;
    botDisplayName: string;
    oaInfo: LineOaInfo;
  }> {
    try {
      const oaInfo = await this.fetchLineOaInfo(
        channelAccessToken,
        channelSecret,
        options,
      );

      return {
        status: 'ok',
        botUserId: oaInfo.botUserId,
        botDisplayName: oaInfo.displayName,
        oaInfo,
      };
    } catch (error) {
      throw new Error(
        `Failed to verify LINE connection: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async fetchLineOaInfo(
    channelAccessToken: string,
    channelSecret: string,
    options?: { lineAccountId?: string },
  ): Promise<LineOaInfo> {
    const client = new line.Client({
      channelAccessToken,
      channelSecret,
    });

    const botInfo = await client.getBotInfo();
    const [followers, quota] = await Promise.all([
      this.fetchFollowerInsight(client, options?.lineAccountId),
      this.fetchMessageQuota(client),
    ]);

    const syncedAt = new Date();

    return {
      botUserId: botInfo.userId,
      basicId: botInfo.basicId,
      premiumId: botInfo.premiumId ?? null,
      displayName: botInfo.displayName,
      pictureUrl: botInfo.pictureUrl ?? null,
      chatMode: botInfo.chatMode ?? null,
      markAsReadMode: botInfo.markAsReadMode ?? null,
      followerCount: followers.followerCount,
      targetedReaches: followers.targetedReaches,
      blockCount: followers.blockCount,
      quotaType: quota.quotaType,
      quotaLimit: quota.quotaLimit,
      quotaUsed: quota.quotaUsed,
      infoSyncedAt: syncedAt.toISOString(),
    };
  }

  private async fetchFollowerInsight(
    client: line.Client,
    lineAccountId?: string,
  ) {
    let followerCount: number | null = null;
    let targetedReaches: number | null = null;
    let blockCount: number | null = null;

    for (const daysAgo of [1, 2, 3]) {
      try {
        const insight = await client.getNumberOfFollowers(
          this.tokyoDateString(daysAgo),
        );

        if (insight.status === 'ready' && 'followers' in insight) {
          followerCount =
            insight.followers != null ? Number(insight.followers) : null;
          targetedReaches =
            insight.targetedReaches != null
              ? Number(insight.targetedReaches)
              : null;
          blockCount =
            insight.blocks != null ? Number(insight.blocks) : null;
          break;
        }
      } catch (error) {
        this.logger.warn(
          `LINE follower insight unavailable: ${error instanceof Error ? error.message : String(error)
          }`,
        );
        break;
      }
    }

    if (followerCount == null && lineAccountId) {
      followerCount = await this.prisma.lineUser.count({
        where: { lineAccountId, status: 'following' },
      });
    }

    return { followerCount, targetedReaches, blockCount };
  }

  private async fetchMessageQuota(client: line.Client) {
    try {
      const [limit, usage] = await Promise.all([
        client.getTargetLimitForAdditionalMessages(),
        client.getNumberOfMessagesSentThisMonth(),
      ]);

      return {
        quotaType: limit.type ?? null,
        quotaLimit: limit.value ?? null,
        quotaUsed: usage.totalUsage ?? null,
      };
    } catch (error) {
      this.logger.warn(
        `LINE quota unavailable: ${error instanceof Error ? error.message : String(error)
        }`,
      );

      return {
        quotaType: null,
        quotaLimit: null,
        quotaUsed: null,
      };
    }
  }

  private tokyoDateString(daysAgo: number): string {
    const tokyo = new Date(Date.now() + 9 * 60 * 60 * 1000);
    tokyo.setUTCDate(tokyo.getUTCDate() - daysAgo);
    const year = tokyo.getUTCFullYear();
    const month = String(tokyo.getUTCMonth() + 1).padStart(2, '0');
    const day = String(tokyo.getUTCDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  toOaInfoFields(oaInfo: LineOaInfo): LineOaInfoFields {
    return {
      ...oaInfo,
      infoSyncedAt: new Date(oaInfo.infoSyncedAt),
    };
  }

  mapStoredOaInfo(account: StoredLineOaInfo): LineOaInfo | null {
    if (!account.botUserId && !account.displayName) {
      return null;
    }

    return {
      botUserId: account.botUserId ?? '',
      basicId: account.basicId ?? '',
      premiumId: account.premiumId ?? null,
      displayName: account.displayName ?? '',
      pictureUrl: account.pictureUrl ?? null,
      chatMode: account.chatMode ?? null,
      markAsReadMode: account.markAsReadMode ?? null,
      followerCount: account.followerCount ?? null,
      targetedReaches: account.targetedReaches ?? null,
      blockCount: account.blockCount ?? null,
      quotaType: account.quotaType ?? null,
      quotaLimit: account.quotaLimit ?? null,
      quotaUsed: account.quotaUsed ?? null,
      infoSyncedAt: (account.infoSyncedAt ?? new Date()).toISOString(),
    };
  }

  async saveLineAccount(
    userId: string,
    channelAccessToken: string,
    channelSecret: string,
    name: string,
    oaInfo?: LineOaInfo,
  ) {
    return await this.lineAccountRepository.saveLineAccount({
      userId,
      name,
      channelAccessToken,
      channelSecret,
      oaInfo: oaInfo ? this.toOaInfoFields(oaInfo) : undefined,
    });
  }

  private maskSecret(value: string | null | undefined) {
    if (!value) {
      return undefined;
    }

    if (value.length <= 4) {
      return '••••';
    }

    return `••••${value.slice(-4)}`;
  }

  private toSettingsAccount(
    account: Awaited<
      ReturnType<LineAccountRepository['getLineAccountByUserId']>
    >,
  ) {
    if (!account) {
      return { connected: false as const };
    }

    return {
      connected: true as const,
      id: account.id,
      name: account.name,
      hasCredentials: Boolean(
        account.channelAccessToken && account.channelSecret,
      ),
      channelAccessTokenMasked: this.maskSecret(account.channelAccessToken),
      channelSecretMasked: this.maskSecret(account.channelSecret),
      oaInfo: this.mapStoredOaInfo(account),
    };
  }

  async getLineAccountForUser(userId: string) {
    const account =
      await this.lineAccountRepository.getLineAccountByUserId(userId);

    return this.toSettingsAccount(account);
  }

  async upsertLineAccount(userId: string, dto: UpsertLineAccountDto) {
    const saved = await this.lineAccountRepository.getLineAccountByUserId(
      userId,
    );
    const token = dto.channelAccessToken?.trim() || saved?.channelAccessToken;
    const secret = dto.channelSecret?.trim() || saved?.channelSecret;

    if (!token || !secret) {
      throw new BadRequestException(
        'LINE credentials are required. Provide them on first connect, or save an account first.',
      );
    }

    const result = await this.verifyConnection(token, secret, {
      lineAccountId: saved?.id,
    });

    if (dto.action === 'save') {
      await this.saveLineAccount(
        userId,
        token,
        secret,
        dto.name || result.botDisplayName || saved?.name || 'LINE Account',
        result.oaInfo,
      );
    } else if (saved) {
      await this.lineAccountRepository.updateOaInfo(
        saved.id,
        this.toOaInfoFields(result.oaInfo),
      );
    }

    const account = await this.lineAccountRepository.getLineAccountByUserId(
      userId,
    );

    return {
      ...this.toSettingsAccount(account),
      status: 'verified' as const,
      saved: dto.action === 'save',
      name: account?.name ?? result.botDisplayName,
      oaInfo: result.oaInfo,
    };
  }

  async testSavedConnection(userId: string) {
    return this.upsertLineAccount(userId, { action: 'test' });
  }

  async findLineUsers(userId: string, query: QueryLineUsersDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const lineAccount = await this.prisma.lineAccount.findUnique({
      where: { userId },
    });

    if (!lineAccount) {
      return {
        data: [],
        meta: { page, limit, total: 0, totalPages: 0 },
      };
    }

    const where: Prisma.LineUserWhereInput = {
      lineAccountId: lineAccount.id,
    };

    if (query.userType && query.userType !== 'All') {
      where.userType = query.userType;
    }

    if (query.search) {
      if (query.searchType === 'displayName') {
        where.displayName = {
          contains: query.search,
          mode: 'insensitive',
        };
      } else if (query.searchType === 'userId') {
        where.lineUserId = {
          contains: query.search,
          mode: 'insensitive',
        };
      } else {
        where.OR = [
          {
            displayName: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
          {
            lineUserId: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
        ];
      }
    }

    if (query.status && query.status !== 'All') {
      where.status = this.mapUiStatusToDb(query.status);
    }

    if (query.dateRange) {
      const date = new Date(query.dateRange);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      where.createdAt = {
        gte: date,
        lt: nextDay,
      };
    }

    const [users, total] = await Promise.all([
      this.prisma.lineUser.findMany({
        where,
        orderBy: { lastActivity: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.lineUser.count({ where }),
    ]);

    const mappedUsers = users.map((user) => this.mapLineUserToResponse(user));

    return {
      data: mappedUsers,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findLineUserById(userId: string, lineUserRecordId: string) {
    const lineAccount = await this.prisma.lineAccount.findUnique({
      where: { userId },
    });

    if (!lineAccount) {
      throw new NotFoundException('LINE account not found');
    }

    const user = await this.prisma.lineUser.findFirst({
      where: {
        id: lineUserRecordId,
        lineAccountId: lineAccount.id,
      },
    });

    if (!user) {
      throw new NotFoundException('LINE user not found');
    }

    return this.mapLineUserToResponse(user);
  }

  private mapLineUserToResponse(user: {
    id: string;
    lineUserId: string;
    displayName: string | null;
    pictureUrl: string | null;
    status: string;
    userType: string;
    phone: string | null;
    followedAt: Date | null;
    lastActivity: Date | null;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      lineUserId: user.lineUserId,
      displayName: user.displayName || 'Unknown',
      avatar: user.pictureUrl || undefined,
      userType: (user.userType === 'Member' ? 'Member' : 'Guest') as
        | 'Member'
        | 'Guest',
      phone: user.phone || undefined,
      status: this.mapDbStatusToUi(user.status),
      tags: [] as string[],
      lastActive: (user.lastActivity || user.createdAt).toISOString(),
      dateAdded: user.createdAt.toISOString(),
      followedDate: user.followedAt?.toISOString(),
    };
  }

  private mapDbStatusToUi(
    status: string,
  ): 'Active' | 'Blocked' | 'Unfollowed' {
    if (status === 'following') {
      return 'Active';
    }

    if (status === 'blocked') {
      return 'Blocked';
    }

    return 'Unfollowed';
  }

  private mapUiStatusToDb(
    status: 'Active' | 'Blocked' | 'Unfollowed',
  ): string {
    if (status === 'Active') {
      return 'following';
    }

    if (status === 'Blocked' || status === 'Unfollowed') {
      return 'blocked';
    }

    return status;
  }
}
