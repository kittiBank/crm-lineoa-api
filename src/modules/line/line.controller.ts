import {
  Controller,
  Post,
  Get,
  Body,
  BadRequestException,
  UseGuards,
  Request,
  Req,
  Headers,
  RawBodyRequest,
  Query,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { LineService } from './line.service';
import { ConfigService } from '@nestjs/config';
import { VerifyLineDto } from './dto/verify-line.dto';
import { QueryLineUsersDto } from './dto/query-line-users.dto';
import * as line from '@line/bot-sdk';
import { validateSignature } from '@line/bot-sdk';
import { Request as ExpressRequest } from 'express';

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
  @ApiOperation({
    summary: 'Webhook endpoint for LINE Bot',
    description:
      'Receives webhook events from LINE platform (message, follow, unfollow, postback, etc.)',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
    schema: { example: { status: 'ok' } },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid signature or malformed request',
  })
  async webhook(
    @Req() req: RawBodyRequest<ExpressRequest>,
    @Headers('x-line-signature') signature: string,
  ): Promise<object> {
    const rawBody = req.rawBody;

    if (!rawBody || !this.validateSignature(rawBody, signature)) {
      throw new BadRequestException('Invalid LINE signature');
    }

    const body = JSON.parse(rawBody.toString()) as line.WebhookRequestBody;

    // Process webhook events
    await this.lineService.handleWebhook(body.events ?? []);

    return { status: 'ok', processedEvents: body.events?.length ?? 0 };
  }

  @Get('users')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get LINE users with pagination and filters' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of LINE users',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getLineUsers(
    @Request() req: { user: { id: string } },
    @Query() query: QueryLineUsersDto,
  ) {
    return this.lineService.findLineUsers(req.user.id, query);
  }

  @Get('users/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get LINE user by ID' })
  @ApiResponse({ status: 200, description: 'LINE user details' })
  @ApiResponse({ status: 404, description: 'LINE user not found' })
  async getLineUserById(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.lineService.findLineUserById(req.user.id, id);
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


  private validateSignature(body: Buffer, signature: string): boolean {
    if (!signature) {
      return false;
    }

    const secret = this.configService.get<string>(
      'LINE_BOT_CHANNEL_SECRET',
    );
    if (!secret || secret === 'your_line_bot_secret_here') {
      console.error('LINE_BOT_CHANNEL_SECRET is not configured');
      return false;
    }

    return validateSignature(body, secret, signature);
  }
}
