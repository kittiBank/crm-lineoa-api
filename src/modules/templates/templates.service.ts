import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateMessageTemplateDto } from './dto/create-message-template.dto';
import { MessageBlockDto } from './dto/message-block.dto';
import { UpdateMessageTemplateDto } from './dto/update-message-template.dto';

const MESSAGE_TYPES = new Set([
  'text',
  'image',
  'video',
  'flex',
  'carousel',
]);

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    const templates = await this.prisma.messageTemplate.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { broadcasts: true },
        },
      },
    });

    return templates.map((template) => this.toResponse(template));
  }

  async findOne(userId: string, id: string) {
    const template = await this.prisma.messageTemplate.findFirst({
      where: { id, userId },
      include: {
        _count: {
          select: { broadcasts: true },
        },
      },
    });

    if (!template) {
      throw new NotFoundException('Message template not found');
    }

    return this.toResponse(template);
  }

  async create(userId: string, dto: CreateMessageTemplateDto) {
    const messageType = this.resolveMessageType(dto.messages);
    const serializedMessages = JSON.stringify(dto.messages);

    const template = await this.prisma.messageTemplate.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        category: dto.category ?? 'Other',
        messageType,
        messages: dto.messages as unknown as Prisma.InputJsonValue,
        content: serializedMessages,
        isActive: dto.isActive ?? true,
      },
      include: {
        _count: {
          select: { broadcasts: true },
        },
      },
    });

    return this.toResponse(template);
  }

  async update(userId: string, id: string, dto: UpdateMessageTemplateDto) {
    await this.findOne(userId, id);

    const messageType = dto.messages
      ? this.resolveMessageType(dto.messages)
      : undefined;
    const serializedMessages = dto.messages
      ? JSON.stringify(dto.messages)
      : undefined;

    const template = await this.prisma.messageTemplate.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        category: dto.category,
        messageType,
        messages: dto.messages
          ? (dto.messages as unknown as Prisma.InputJsonValue)
          : undefined,
        content: serializedMessages,
        isActive: dto.isActive,
      },
      include: {
        _count: {
          select: { broadcasts: true },
        },
      },
    });

    return this.toResponse(template);
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    await this.prisma.messageTemplate.delete({
      where: { id },
    });

    return { status: 'ok', id };
  }

  private resolveMessageType(messages: MessageBlockDto[]): string {
    if (messages.length === 0) {
      return 'text';
    }

    if (messages.length > 1) {
      return 'multi';
    }

    const type = messages[0]?.type;
    return typeof type === 'string' && MESSAGE_TYPES.has(type) ? type : 'text';
  }

  private parseMessages(template: {
    messages: Prisma.JsonValue;
    content: string;
  }): MessageBlockDto[] {
    const candidates = [template.messages, this.tryParseJson(template.content)];

    for (const candidate of candidates) {
      const parsed = this.normalizeMessageBlocks(candidate);
      if (parsed.length > 0) {
        return parsed;
      }
    }

    return [];
  }

  private tryParseJson(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  private normalizeMessageBlocks(value: unknown): MessageBlockDto[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) &&
          typeof item === 'object' &&
          !Array.isArray(item) &&
          typeof item.type === 'string' &&
          MESSAGE_TYPES.has(item.type),
      )
      .map((item) => item as MessageBlockDto);
  }

  private toResponse(
    template: {
      id: string;
      name: string;
      description: string | null;
      category: string;
      messageType: string;
      messages: Prisma.JsonValue;
      isActive: boolean;
      usageCount: number;
      createdAt: Date;
      updatedAt: Date;
      _count?: { broadcasts: number };
    },
  ) {
    const messages = this.parseMessages(template);

    return {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      type: template.messageType,
      messages,
      usageCount: template._count?.broadcasts ?? template.usageCount,
      isActive: template.isActive,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    };
  }
}
