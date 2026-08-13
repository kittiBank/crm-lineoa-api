import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
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

const MAX_TEMPLATE_IMAGE_BYTES = 10 * 1024 * 1024;
const TEMPLATE_MEDIA_DISPLAY_TTL_SECONDS = 60 * 60;

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

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

    return Promise.all(
      templates.map((template) => this.toResponse(template)),
    );
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
    this.assertPersistedMediaUrls(dto.messages);
    const messages = this.canonicalizeMediaUrls(dto.messages);
    const messageType = this.resolveMessageType(messages);
    const serializedMessages = JSON.stringify(messages);

    const template = await this.prisma.messageTemplate.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        category: dto.category ?? 'Other',
        messageType,
        messages: messages as unknown as Prisma.InputJsonValue,
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

  async uploadImage(
    userId: string,
    file:
      | {
          buffer: Buffer;
          mimetype: string;
          originalname?: string;
        }
      | undefined,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Image file is required');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('File must be an image');
    }

    if (file.buffer.length > MAX_TEMPLATE_IMAGE_BYTES) {
      throw new BadRequestException('Image must be 10 MB or smaller');
    }

    const extension = this.resolveImageExtension(
      file.mimetype,
      file.originalname,
    );
    const storageKey = this.storageService.buildKey(
      'templates',
      `${userId}.${extension}`,
    );

    try {
      const uploadResult = await this.storageService.upload(
        storageKey,
        file.buffer,
        file.mimetype,
      );
      const displayUrl = await this.storageService.getPresignedUrl(
        uploadResult.key,
        TEMPLATE_MEDIA_DISPLAY_TTL_SECONDS,
      );

      return {
        url: uploadResult.url,
        displayUrl,
        key: uploadResult.key,
      };
    } catch (error) {
      this.logger.error(
        `Template image upload failed for user ${userId}: ${
          error instanceof Error ? error.message : error
        }`,
      );
      throw new BadRequestException(
        'Failed to upload image to storage. Check S3/MinIO configuration.',
      );
    }
  }

  async update(userId: string, id: string, dto: UpdateMessageTemplateDto) {
    await this.findOne(userId, id);

    let messages: MessageBlockDto[] | undefined;
    if (dto.messages) {
      this.assertPersistedMediaUrls(dto.messages);
      messages = this.canonicalizeMediaUrls(dto.messages);
    }

    const messageType = messages
      ? this.resolveMessageType(messages)
      : undefined;
    const serializedMessages = messages ? JSON.stringify(messages) : undefined;

    const template = await this.prisma.messageTemplate.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        category: dto.category,
        messageType,
        messages: messages
          ? (messages as unknown as Prisma.InputJsonValue)
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

    return value.filter(
      (item): item is MessageBlockDto =>
        Boolean(item) &&
        typeof item === 'object' &&
        !Array.isArray(item) &&
        typeof (item as MessageBlockDto).type === 'string' &&
        MESSAGE_TYPES.has((item as MessageBlockDto).type),
    );
  }

  private async toResponse(
    template: {
      id: string;
      name: string;
      description: string | null;
      category: string;
      messageType: string;
      messages: Prisma.JsonValue;
      content: string;
      isActive: boolean;
      usageCount: number;
      createdAt: Date;
      updatedAt: Date;
      _count?: { broadcasts: number };
    },
  ) {
    const messages = await this.withAccessibleMediaUrls(
      this.parseMessages(template),
    );

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

  private canonicalizeMediaUrls(messages: MessageBlockDto[]): MessageBlockDto[] {
    return messages.map((message) => ({
      ...message,
      imageUrl: message.imageUrl
        ? this.storageService.toStablePublicUrl(message.imageUrl)
        : message.imageUrl,
      previewImageUrl: message.previewImageUrl
        ? this.storageService.toStablePublicUrl(message.previewImageUrl)
        : message.previewImageUrl,
      columns: message.columns?.map((column) => ({
        ...column,
        imageUrl: column.imageUrl
          ? this.storageService.toStablePublicUrl(column.imageUrl)
          : column.imageUrl,
      })),
    }));
  }

  private async withAccessibleMediaUrls(
    messages: MessageBlockDto[],
  ): Promise<MessageBlockDto[]> {
    return Promise.all(
      messages.map(async (message) => ({
        ...message,
        imageUrl: message.imageUrl
          ? await this.storageService.resolveAccessibleUrl(
              message.imageUrl,
              TEMPLATE_MEDIA_DISPLAY_TTL_SECONDS,
            )
          : message.imageUrl,
        previewImageUrl: message.previewImageUrl
          ? await this.storageService.resolveAccessibleUrl(
              message.previewImageUrl,
              TEMPLATE_MEDIA_DISPLAY_TTL_SECONDS,
            )
          : message.previewImageUrl,
        columns: message.columns
          ? await Promise.all(
              message.columns.map(async (column) => ({
                ...column,
                imageUrl: column.imageUrl
                  ? await this.storageService.resolveAccessibleUrl(
                      column.imageUrl,
                      TEMPLATE_MEDIA_DISPLAY_TTL_SECONDS,
                    )
                  : column.imageUrl,
              })),
            )
          : message.columns,
      })),
    );
  }

  private assertPersistedMediaUrls(messages: MessageBlockDto[]): void {
    for (const message of messages) {
      const urls = this.collectMediaUrls(message);
      for (const url of urls) {
        if (url.startsWith('blob:')) {
          throw new BadRequestException(
            'Image must be uploaded before saving the template. Blob URLs are not allowed.',
          );
        }
      }
    }
  }

  private collectMediaUrls(message: MessageBlockDto): string[] {
    const urls: string[] = [];

    if (typeof message.imageUrl === 'string' && message.imageUrl) {
      urls.push(message.imageUrl);
    }
    if (
      typeof message.previewImageUrl === 'string' &&
      message.previewImageUrl
    ) {
      urls.push(message.previewImageUrl);
    }
    if (Array.isArray(message.columns)) {
      for (const column of message.columns) {
        if (typeof column?.imageUrl === 'string' && column.imageUrl) {
          urls.push(column.imageUrl);
        }
      }
    }

    return urls;
  }

  private resolveImageExtension(
    mimeType: string,
    originalname?: string,
  ): string {
    if (mimeType === 'image/jpeg') {
      return 'jpg';
    }
    if (mimeType === 'image/png') {
      return 'png';
    }
    if (mimeType === 'image/gif') {
      return 'gif';
    }
    if (mimeType === 'image/webp') {
      return 'webp';
    }

    const fromName = originalname?.split('.').pop()?.toLowerCase();
    if (fromName && /^[a-z0-9]+$/.test(fromName)) {
      return fromName;
    }

    return 'bin';
  }
}
