import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as line from '@line/bot-sdk';
import { PrismaService } from '@/prisma/prisma.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Injectable()
export class MemberLoginService {
  private readonly logger = new Logger(MemberLoginService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async requestOtp(dto: RequestOtpDto) {
    const phone = this.normalizePhone(dto.phone);
    const lineAccount = await this.getDefaultLineAccount();

    if (!lineAccount) {
      throw new NotFoundException('LINE account not found');
    }

    const lineUser = await this.prisma.lineUser.findUnique({
      where: {
        lineAccountId_lineUserId: {
          lineAccountId: lineAccount.id,
          lineUserId: dto.lineUserId,
        },
      },
    });

    if (!lineUser) {
      throw new NotFoundException('LINE user not found');
    }

    if (lineUser.userType === 'Member') {
      throw new BadRequestException('User is already a member');
    }

    const phoneOwner = await this.prisma.lineUser.findFirst({
      where: {
        lineAccountId: lineAccount.id,
        phone,
        NOT: { id: lineUser.id },
      },
    });

    if (phoneOwner) {
      throw new BadRequestException('Phone number is already registered');
    }

    const ttlSeconds = this.getOtpTtlSeconds();
    const code = this.getFixedOtpCode();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await this.prisma.otpSession.updateMany({
      where: {
        lineUserId: lineUser.id,
        verifiedAt: null,
      },
      data: {
        expiresAt: new Date(0),
      },
    });

    const session = await this.prisma.otpSession.create({
      data: {
        lineUserId: lineUser.id,
        phone,
        code,
        expiresAt,
      },
    });

    this.logger.log(
      `OTP requested for lineUser=${dto.lineUserId} phone=${phone} expiresAt=${expiresAt.toISOString()}`,
    );

    return {
      status: 'ok',
      expiresIn: ttlSeconds,
      expiresAt: expiresAt.toISOString(),
      sessionId: session.id,
      // Demo only — fixed OTP, no SMS provider
      demoOtp: code,
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const phone = this.normalizePhone(dto.phone);
    const lineAccount = await this.getDefaultLineAccount();

    if (!lineAccount) {
      throw new NotFoundException('LINE account not found');
    }

    const lineUser = await this.prisma.lineUser.findUnique({
      where: {
        lineAccountId_lineUserId: {
          lineAccountId: lineAccount.id,
          lineUserId: dto.lineUserId,
        },
      },
    });

    if (!lineUser) {
      throw new NotFoundException('LINE user not found. Request OTP first.');
    }

    if (lineUser.userType === 'Member') {
      return {
        status: 'ok',
        userType: 'Member' as const,
        phone: lineUser.phone,
        richMenuLinked: false,
        message: 'User is already a member',
      };
    }

    const session = await this.prisma.otpSession.findFirst({
      where: {
        lineUserId: lineUser.id,
        phone,
        verifiedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) {
      throw new BadRequestException('OTP session not found. Request a new OTP.');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('OTP has expired. Request a new OTP.');
    }

    if (session.attempts >= 5) {
      throw new BadRequestException(
        'Too many invalid attempts. Request a new OTP.',
      );
    }

    if (session.code !== dto.otp) {
      await this.prisma.otpSession.update({
        where: { id: session.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid OTP');
    }

    const phoneOwner = await this.prisma.lineUser.findFirst({
      where: {
        lineAccountId: lineAccount.id,
        phone,
        NOT: { id: lineUser.id },
      },
    });

    if (phoneOwner) {
      throw new BadRequestException('Phone number is already registered');
    }

    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.otpSession.update({
        where: { id: session.id },
        data: { verifiedAt: now },
      }),
      this.prisma.lineUser.update({
        where: { id: lineUser.id },
        data: {
          userType: 'Member',
          phone,
          phoneVerifiedAt: now,
          lastActivity: now,
        },
      }),
    ]);

    const richMenuLinked = await this.linkMemberRichMenu(
      lineAccount,
      dto.lineUserId,
    );

    this.logger.log(
      `OTP verified: lineUser=${dto.lineUserId} promoted to Member richMenuLinked=${richMenuLinked}`,
    );

    return {
      status: 'ok',
      userType: 'Member' as const,
      phone,
      richMenuLinked,
      message: 'OTP verified. User upgraded to Member.',
    };
  }

  private async linkMemberRichMenu(
    lineAccount: { id: string; channelAccessToken: string; channelSecret: string },
    lineUserId: string,
  ): Promise<boolean> {
    const memberMenu = await this.prisma.richMenu.findFirst({
      where: {
        lineAccountId: lineAccount.id,
        menuType: 'member',
        isActive: true,
      },
    });

    if (!memberMenu?.lineRichMenuId) {
      this.logger.warn(
        `No active member rich menu for lineAccount=${lineAccount.id}`,
      );
      return false;
    }

    try {
      const client = new line.Client({
        channelAccessToken: lineAccount.channelAccessToken,
        channelSecret: lineAccount.channelSecret,
      });

      await client.linkRichMenuToUser(lineUserId, memberMenu.lineRichMenuId);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to link member rich menu to ${lineUserId}: ${
          error instanceof Error ? error.message : error
        }`,
      );
      return false;
    }
  }

  private async getDefaultLineAccount() {
    return this.prisma.lineAccount.findFirst({
      orderBy: { createdAt: 'desc' },
    });
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/[\s-]/g, '');
  }

  private getFixedOtpCode(): string {
    return this.configService.get<string>('OTP_CODE', '123456');
  }

  private getOtpTtlSeconds(): number {
    const raw = this.configService.get<string>('OTP_TTL_SECONDS', '60');
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 60;
  }
}
