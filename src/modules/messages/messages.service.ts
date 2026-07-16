import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  async create(createMessageDto: CreateMessageDto) {
    return await this.prisma.message.create({
      data: {
        lineAccountId: createMessageDto.lineAccountId,
        lineUserId: createMessageDto.lineUserId,
        message: createMessageDto.message,
      },
    });
  }

  async findAll(lineUserId?: string) {
    return await this.prisma.message.findMany({
      where: lineUserId ? { lineUserId } : {},
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return await this.prisma.message.findUnique({
      where: { id },
    });
  }

  async markAsRead(id: string) {
    return await this.prisma.message.update({
      where: { id },
      data: { isRead: true },
    });
  }
}
