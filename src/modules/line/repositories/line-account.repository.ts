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

    return {
      id: lineAccount.id,
      name: lineAccount.name,
      createdAt: lineAccount.createdAt,
    };
  }

  async updateOaInfo(accountId: string, oaInfo: LineOaInfoFields) {
    return this.prisma.lineAccount.update({
      where: { id: accountId },
      data: {
        ...oaInfo,
        name: oaInfo.displayName || undefined,
      },
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
