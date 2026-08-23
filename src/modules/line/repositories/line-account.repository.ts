import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { LineOaInfoFields } from '../types/line-oa-info';

export interface CreateLineAccountInput {
  userId: string;
  name: string;
  channelAccessToken: string;
  channelSecret: string;
  oaInfo?: LineOaInfoFields;
}

export interface LineAccountResponse {
  id: string;
  name: string;
  createdAt: Date;
}

@Injectable()
export class LineAccountRepository {
  constructor(private prisma: PrismaService) { }

  /**
   * Save LINE Account credentials to database
   * Deletes existing account if any (only one per user)
   */
  async saveLineAccount(
    input: CreateLineAccountInput,
  ): Promise<LineAccountResponse> {
    await this.prisma.lineAccount.deleteMany({
      where: { userId: input.userId },
    });

    const lineAccount = await this.prisma.lineAccount.create({
      data: {
        userId: input.userId,
        name: input.name,
        channelAccessToken: input.channelAccessToken,
        channelSecret: input.channelSecret,
        ...(input.oaInfo ?? {}),
      },
    });

    if (input.oaInfo) {
      const quotaRemaining =
        input.oaInfo.quotaLimit != null && input.oaInfo.quotaUsed != null
          ? Math.max(0, input.oaInfo.quotaLimit - input.oaInfo.quotaUsed)
          : null;

      await this.updateMessageQuota(lineAccount.id, {
        quotaType: input.oaInfo.quotaType,
        quotaLimit: input.oaInfo.quotaLimit,
        quotaUsed: input.oaInfo.quotaUsed,
        quotaRemaining,
      });
    }

    return {
      id: lineAccount.id,
      name: lineAccount.name,
      createdAt: lineAccount.createdAt,
    };
  }

  async updateOaInfo(accountId: string, oaInfo: LineOaInfoFields) {
    const updated = await this.prisma.lineAccount.update({
      where: { id: accountId },
      data: {
        ...oaInfo,
        name: oaInfo.displayName || undefined,
      },
    });

    const quotaRemaining =
      oaInfo.quotaLimit != null && oaInfo.quotaUsed != null
        ? Math.max(0, oaInfo.quotaLimit - oaInfo.quotaUsed)
        : null;

    await this.updateMessageQuota(accountId, {
      quotaType: oaInfo.quotaType,
      quotaLimit: oaInfo.quotaLimit,
      quotaUsed: oaInfo.quotaUsed,
      quotaRemaining,
    });

    return updated;
  }

  async updateMessageQuota(
    accountId: string,
    data: {
      quotaType: string | null;
      quotaLimit: number | null;
      quotaUsed: number | null;
      quotaRemaining: number | null;
    },
  ) {
    await this.prisma.$executeRaw`
      UPDATE "line_accounts"
      SET
        "quotaType" = ${data.quotaType},
        "quotaLimit" = ${data.quotaLimit},
        "quotaUsed" = ${data.quotaUsed},
        "quotaRemaining" = ${data.quotaRemaining},
        "quotaSyncedAt" = NOW(),
        "updatedAt" = NOW()
      WHERE id = ${accountId}
    `;

    return this.prisma.lineAccount.findUnique({
      where: { id: accountId },
    });
  }

  async getLineAccountByUserId(userId: string) {
    return await this.prisma.lineAccount.findUnique({
      where: { userId },
    });
  }

  async getLineAccountById(id: string) {
    return await this.prisma.lineAccount.findUnique({
      where: { id },
    });
  }

  async deleteLineAccount(id: string) {
    return await this.prisma.lineAccount.delete({
      where: { id },
    });
  }
}
