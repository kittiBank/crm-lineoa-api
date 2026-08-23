import {
  Controller,
  Post,
  Get,
  Body,
  BadRequestException,
  HttpException,
  HttpCode,
  HttpStatus,
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
import { UpsertLineAccountDto, VerifyLineDto } from './dto/verify-line.dto';
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
  ) { }

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

  @Get('account')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Get the current user LINE Official Account (DB only, no live LINE calls)'
  })
  @ApiResponse({
    status: 200,
    description:
      'Lean settings payload: connected flag, masked credentials, saved OA info'
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getLineAccount(@Request() req: { user: { id: string } }) {
    return this.lineService.getLineAccountForUser(req.user.id);
  }

  @Get('message-quota')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current LINE monthly message quota, used, and remaining',
  })
  @ApiResponse({
    status: 200,
    description:
      '{ success: true, data: [{ quota, used, remaining, ... }] }. Cached 5 minutes unless a broadcast was sent after the last sync.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMessageQuota(@Request() req: { user: { id: string } }) {
    return this.lineService.getMessageQuotaForUser(req.user.id);
  }

  @Post('account')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Test or save LINE Official Account credentials',
  })
  @ApiResponse({
    status: 200,
    description: 'Lean settings payload after test or save',
  })
  @ApiResponse({ status: 400, description: 'Failed to verify connection' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async upsertAccount(
    @Request() req: { user: { id: string } },
    @Body() dto: UpsertLineAccountDto,
  ) {
    try {
      return await this.lineService.upsertLineAccount(req.user.id, dto);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Failed to verify LINE connection',
      );
    }
  }

  @Post('account/test')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Deprecated: use POST /line/account with action=test',
    deprecated: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Saved LINE Bot connection verified successfully',
  })
  @ApiResponse({ status: 400, description: 'Failed to verify connection' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async testSavedConnection(@Request() req: { user: { id: string } }) {
    try {
      return await this.lineService.upsertLineAccount(req.user.id, {
        action: 'test',
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Failed to verify LINE connection',
      );
    }
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Deprecated: use POST /line/account with action=test|save',
    deprecated: true,
  })
  @ApiResponse({
    status: 200,
    description: 'LINE Bot connection verified successfully (and saved to DB if requested)',
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
    @Request() req: { user: { id: string } },
    @Body() verifyLineDto: VerifyLineDto,
  ) {
    try {
      return await this.lineService.upsertLineAccount(req.user.id, {
        action: verifyLineDto.saveToDb ? 'save' : 'test',
        channelAccessToken: verifyLineDto.channelAccessToken,
        channelSecret: verifyLineDto.channelSecret,
        name: verifyLineDto.name,
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Failed to verify LINE connection',
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
