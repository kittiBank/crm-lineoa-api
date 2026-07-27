import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { MemberLoginService } from './member-login.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@ApiTags('Member Login')
@Controller('member-login')
export class MemberLoginController {
  constructor(private readonly memberLoginService: MemberLoginService) {}

  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request OTP for member login',
    description:
      'Creates an OTP session for a LINE guest user. Demo mode uses a fixed OTP code.',
  })
  @ApiOkResponse({
    description: 'OTP session created',
    schema: {
      example: {
        status: 'ok',
        expiresIn: 60,
        expiresAt: '2026-07-27T09:01:00.000Z',
        sessionId: 'clx...',
        demoOtp: '123456',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid request or already a member' })
  @ApiNotFoundResponse({
    description: 'LINE account or LINE user not found in line_users',
  })
  async requestOtp(@Body() dto: RequestOtpDto) {
    return this.memberLoginService.requestOtp(dto);
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify OTP and upgrade Guest to Member',
    description:
      'Validates OTP, updates userType to Member, and links the active member rich menu.',
  })
  @ApiOkResponse({
    description: 'OTP verified and user upgraded',
    schema: {
      example: {
        status: 'ok',
        userType: 'Member',
        phone: '0812345678',
        richMenuLinked: true,
        message: 'OTP verified. User upgraded to Member.',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid or expired OTP' })
  @ApiNotFoundResponse({ description: 'LINE user or account not found' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.memberLoginService.verifyOtp(dto);
  }
}
