import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateAutoMessageDto } from './dto/create-auto-message.dto';
import { UpdateAutoMessageDto } from './dto/update-auto-message.dto';

@Injectable()
export class AutoMessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    const items = await this.prisma.autoMessage.findMany({
      where: { userId },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      include: this.defaultInclude(),
    });

    return items.map((item) => this.toResponse(item));
  }

  async findOne(userId: string, id: string) {
    const item = await this.prisma.autoMessage.findFirst({
      where: { id, userId },
      include: this.defaultInclude(),
    });

    if (!item) {
      throw new NotFoundException('Auto message not found');
    }

    return this.toResponse(item);
  }

  async create(userId: string, dto: CreateAutoMessageDto) {
    await this.ensureTemplateExists(userId, dto.templateId);

    try {
      const item = await this.prisma.autoMessage.create({
        data: {
          userId,
          name: dto.name,
          keyword: dto.keyword.trim(),
          matchType: dto.matchType ?? 'exact',
          templateId: dto.templateId,
          priority: dto.priority ?? 0,
          isActive: dto.isActive ?? true,
        },
        include: this.defaultInclude(),
      });

      return this.toResponse(item);
    } catch (error) {
      this.handleUniqueKeywordError(error);
      throw error;
    }
  }

  async update(userId: string, id: string, dto: UpdateAutoMessageDto) {
    await this.findOne(userId, id);

    if (dto.templateId) {
      await this.ensureTemplateExists(userId, dto.templateId);
    }

    try {
      const item = await this.prisma.autoMessage.update({
        where: { id },
        data: {
          name: dto.name,
          keyword: dto.keyword?.trim(),
          matchType: dto.matchType,
          templateId: dto.templateId,
          priority: dto.priority,
          isActive: dto.isActive,
        },
        include: this.defaultInclude(),
      });

      return this.toResponse(item);
    } catch (error) {
      this.handleUniqueKeywordError(error);
      throw error;
    }
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    await this.prisma.autoMessage.delete({
      where: { id },
    });

    return { status: 'ok', id };
  }

  private async ensureTemplateExists(userId: string, templateId: string) {
    const template = await this.prisma.messageTemplate.findFirst({
      where: { id: templateId, userId, isActive: true },
    });

    if (!template) {
      throw new NotFoundException('Message template not found');
    }
  }

  private handleUniqueKeywordError(error: unknown): never | void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'An auto message with this keyword already exists',
      );
    }

    if (error instanceof BadRequestException) {
      throw error;
    }
  }

  private defaultInclude() {
    return {
      template: {
        select: {
          id: true,
          name: true,
          messageType: true,
          isActive: true,
        },
      },
    };
  }

  private toResponse(item: {
    id: string;
    name: string;
    keyword: string;
    matchType: string;
    templateId: string;
    priority: number;
    isActive: boolean;
    triggerCount: number;
    createdAt: Date;
    updatedAt: Date;
    template?: {
      id: string;
      name: string;
      messageType: string;
      isActive: boolean;
    } | null;
  }) {
    return {
      id: item.id,
      name: item.name,
      keyword: item.keyword,
      matchType: item.matchType,
      templateId: item.templateId,
      priority: item.priority,
      isActive: item.isActive,
      triggerCount: item.triggerCount,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      template: item.template
        ? {
            id: item.template.id,
            name: item.template.name,
            type: item.template.messageType,
            isActive: item.template.isActive,
          }
        : null,
    };
  }
}
