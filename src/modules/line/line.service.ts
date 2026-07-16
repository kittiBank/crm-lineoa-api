import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as line from '@line/bot-sdk';

@Injectable()
export class LineService {
  private lineClient: line.Client;

  constructor(private configService: ConfigService) {
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
}
