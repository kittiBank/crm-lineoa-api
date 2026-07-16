import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LineAccountRepository } from './repositories/line-account.repository';
import * as line from '@line/bot-sdk';

@Injectable()
export class LineService {
  private lineClient: line.Client;

  constructor(
    private configService: ConfigService,
    private lineAccountRepository: LineAccountRepository,
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
    for (const event of events) {
      if (event.type === 'message') {
        console.log('Message event received:', event);
        // Handle message event
      }
      if (event.type === 'follow') {
        console.log('Follow event received:', event);
        // Handle follow event
      }
      if (event.type === 'unfollow') {
        console.log('Unfollow event received:', event);
        // Handle unfollow event
      }
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
}
