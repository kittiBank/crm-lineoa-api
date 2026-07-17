import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LineAccountRepository } from './repositories/line-account.repository';
import * as line from '@line/bot-sdk';
import { PrismaService } from '../../prisma/prisma.service';
import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { QueryLineUsersDto } from './dto/query-line-users.dto';

@Injectable()
export class LineService {
  private lineClient: line.Client;
  private logger = new Logger('LineService');

  constructor(
    private configService: ConfigService,
    private lineAccountRepository: LineAccountRepository,
    private prisma: PrismaService,
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
      // Get or create LINE user
      const lineUser = await this.getOrCreateLineUser(
        event.source.userId as string,
      );

      // Save message to database
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

        // Update last activity
        await this.prisma.lineUser.update({
          where: { id: lineUser.id },
          data: { lastActivity: new Date() },
        });
      }

      // Send auto-reply
      const replyMessages: line.Message[] = [
        {
          type: 'text',
          text: 'สวัสดีค่ะ! ขอบคุณที่ติดต่อเรา เราได้รับข้อความของคุณแล้ว จะติดตอบกลับให้เร็วที่สุดค่ะ',
        },
      ];

      await this.replyMessage(event.replyToken, replyMessages);
    } catch (error) {
      this.logger.error('Error handling message event:', error);
      // Send error message to user
      try {
        await this.replyMessage(event.replyToken, [
          {
            type: 'text',
            text: 'ขออภัย เกิดข้อผิดพลาดในการประมวลผลข้อความของคุณ กรุณาลองอีกครั้ง',
          },
        ]);
      } catch (replyError) {
        this.logger.error('Error sending error reply:', replyError);
      }
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
      // Update user status to blocked/unfollowed
      await this.prisma.lineUser.updateMany({
        where: { lineUserId: event.source.userId as string },
        data: { status: 'blocked' },
      });
    } catch (error) {
      this.logger.error('Error handling unfollow event:', error);
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
      const lineUser = await this.getOrCreateLineUser(
        event.source.userId as string,
      );

      // Parse postback data (format: action=value)
      const [action, value] = event.postback.data.split('=');

      const replyMessages: line.Message[] = [
        {
          type: 'text',
          text: `คุณเลือก: ${value}`,
        },
      ];

      await this.replyMessage(event.replyToken, replyMessages);
    } catch (error) {
      this.logger.error('Error handling postback event:', error);
    }
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

  async getProfile(userId: string): Promise<line.Profile> {
    return await this.lineClient.getProfile(userId);
  }

  async verifyConnection(
    channelAccessToken: string,
    channelSecret: string,
  ): Promise<{ status: string; botUserId: string; botDisplayName: string }> {
    try {
      // Create temporary client with provided credentials
      const tempClient = new line.Client({
        channelAccessToken,
        channelSecret,
      });

      // Get bot info to verify connection
      const botInfo = await tempClient.getBotInfo();

      return {
        status: 'ok',
        botUserId: botInfo.userId,
        botDisplayName: botInfo.displayName,
      };
    } catch (error) {
      throw new Error(
        `Failed to verify LINE connection: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async saveLineAccount(
    userId: string,
    channelAccessToken: string,
    channelSecret: string,
    name: string,
  ) {
    return await this.lineAccountRepository.saveLineAccount({
      userId,
      name,
      channelAccessToken,
      channelSecret,
    });
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

    if (query.userType === 'Guest') {
      return {
        data: [],
        meta: { page, limit, total: 0, totalPages: 0 },
      };
    }

    const where: Prisma.LineUserWhereInput = {
      lineAccountId: lineAccount.id,
    };

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
    followedAt: Date | null;
    lastActivity: Date | null;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      lineUserId: user.lineUserId,
      displayName: user.displayName || 'Unknown',
      avatar: user.pictureUrl || undefined,
      userType: 'Member' as const,
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
