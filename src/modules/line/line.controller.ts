import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LineService } from './line.service';
import { ConfigService } from '@nestjs/config';
import * as line from '@line/bot-sdk';
import { createHmac } from 'crypto';

@ApiTags('LINE')
@Controller('line')
export class LineController {
  constructor(
    private lineService: LineService,
    private configService: ConfigService,
  ) {}

  @Post('webhook')
  @ApiOperation({ summary: 'Webhook endpoint for LINE Bot' })
  async webhook(@Body() body: line.WebhookRequestBody): Promise<object> {
    const signature = this.validateSignature(body);
    if (!signature) {
      throw new BadRequestException('Invalid signature');
    }

    await this.lineService.handleWebhook(body.events);
    return { status: 'ok' };
  }

  private validateSignature(body: any): boolean {
    const signature =
      process.env['HTTP_X_LINE_SIGNATURE'] || '';
    const secret = this.configService.get<string>(
      'LINE_BOT_CHANNEL_SECRET',
    ) || '';
    const hash = createHmac('sha256', secret)
      .update(JSON.stringify(body))
      .digest('base64');
    return hash === signature;
  }
}
