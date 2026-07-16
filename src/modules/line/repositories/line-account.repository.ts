import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export interface CreateLineAccountInput {
  userId: string;
  name: string;
  channelAccessToken: string;
  channelSecret: string;
}

export interface LineAccountResponse {
  id: string;
  name: string;
  createdAt: Date;
}

@Injectable()
export class LineAccountRepository {
  constructor(private prisma: PrismaService) {}

  /**
   * Save LINE Account credentials to database
   * Deletes existing account if any (only one per user)
   */
  async saveLineAccount(input: CreateLineAccountInput): Promise<LineAccountResponse> {
    // Delete existing account if any (only one per user)
    await this.prisma.lineAccount.deleteMany({
      where: { userId: input.userId },
    });

    // Create new LINE account
    const lineAccount = await this.prisma.lineAccount.create({
      data: {
        userId: input.userId,
        name: input.name,
        channelAccessToken: input.channelAccessToken,
        channelSecret: input.channelSecret,
      },
    });

    return {
      id: lineAccount.id,
      name: lineAccount.name,
      createdAt: lineAccount.createdAt,
    };
  }

  /**
   * Get LINE Account by user ID
   */
  async getLineAccountByUserId(userId: string) {
    return await this.prisma.lineAccount.findUnique({
      where: { userId },
    });
  }

  /**
   * Get LINE Account by ID
   */
  async getLineAccountById(id: string) {
    return await this.prisma.lineAccount.findUnique({
      where: { id },
    });
  }

  /**
   * Delete LINE Account
   */
  async deleteLineAccount(id: string) {
    return await this.prisma.lineAccount.delete({
      where: { id },
    });
  }
}
