import { Controller, Post, Body, BadRequestException, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { LineService } from './line.service';
import { ConfigService } from '@nestjs/config';
import { VerifyLineDto } from './dto/verify-line.dto';
import * as line from '@line/bot-sdk';
import { createHmac } from 'crypto';

// JWT Auth Guard (using built-in NestJS guard)
import { AuthGuard } from '@nestjs/passport';

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

  @Post('verify')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify LINE Bot connection with provided credentials' })
  @ApiResponse({
    status: 200,
    description: 'LINE Bot connection verified successfully (and saved to DB if requested)',
    schema: {
      example: {
        status: 'verified',
        botUserId: 'U1234567890abcdef1234567890abcdef',
        botDisplayName: 'My LINE Bot',
        saved: true,
        account: {
          id: 'account-id',
          name: 'My LINE Bot',
          createdAt: '2024-07-16T10:00:00Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Failed to verify connection - invalid credentials',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  async verifyConnection(
    @Request() req: any,
    @Body() verifyLineDto: VerifyLineDto,
  ): Promise<any> {
    try {
      // Verify connection
      const verifyResult = await this.lineService.verifyConnection(
        verifyLineDto.channelAccessToken,
        verifyLineDto.channelSecret,
      );

      // Check if should save to DB
      const shouldSave = verifyLineDto.saveToDb === 'true';
      let savedAccount: any = null;

      if (shouldSave) {
        const userId = req.user?.id;
        if (!userId) {
          throw new BadRequestException('User ID not found in JWT context');
        }

        const accountName = verifyLineDto.name || verifyLineDto.botDisplayName || 'LINE Bot';
        savedAccount = await this.lineService.saveLineAccount(
          userId,
          verifyLineDto.channelAccessToken,
          verifyLineDto.channelSecret,
          accountName,
        );
      }

      return {
        status: 'verified',
        botUserId: verifyResult.botUserId,
        botDisplayName: verifyResult.botDisplayName,
        saved: shouldSave,
        ...(shouldSave && { account: savedAccount }),
      };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to verify LINE connection',
      );
    }
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
