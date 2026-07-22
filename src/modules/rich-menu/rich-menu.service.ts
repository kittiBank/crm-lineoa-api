import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as line from '@line/bot-sdk';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { LineAccountRepository } from '../line/repositories/line-account.repository';
import { StorageService } from '../storage/storage.service';
import { CreateRichMenuDto } from './dto/create-rich-menu.dto';
import { getLayoutById } from './constants/layouts';

@Injectable()
export class RichMenuService {
  private readonly logger = new Logger(RichMenuService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly lineAccountRepository: LineAccountRepository,
    private readonly storageService: StorageService,
  ) {}

  async findAll(userId: string) {
    const lineAccount =
      await this.lineAccountRepository.getLineAccountByUserId(userId);

    if (!lineAccount) {
      return [];
    }

    return this.prisma.richMenu.findMany({
      where: { lineAccountId: lineAccount.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, richMenuId: string) {
    const lineAccount =
      await this.lineAccountRepository.getLineAccountByUserId(userId);

    if (!lineAccount) {
      throw new NotFoundException('LINE account not found');
    }

    const menu = await this.prisma.richMenu.findFirst({
      where: {
        id: richMenuId,
        lineAccountId: lineAccount.id,
      },
    });

    if (!menu) {
      throw new NotFoundException('Rich menu not found');
    }

    return menu;
  }

  async remove(userId: string, richMenuId: string) {
    const lineAccount =
      await this.lineAccountRepository.getLineAccountByUserId(userId);

    if (!lineAccount) {
      throw new NotFoundException('LINE account not found');
    }

    const menu = await this.prisma.richMenu.findFirst({
      where: {
        id: richMenuId,
        lineAccountId: lineAccount.id,
      },
    });

    if (!menu) {
      throw new NotFoundException('Rich menu not found');
    }

    if (menu.lineRichMenuId) {
      const client = this.getLineClient(lineAccount);
      try {
        await client.deleteRichMenu(menu.lineRichMenuId);
      } catch (error) {
        this.logger.warn(
          `Failed to delete LINE rich menu ${menu.lineRichMenuId}: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }

    const storageKey = this.extractStorageKey(menu.imageUrl);
    if (storageKey) {
      await this.storageService.delete(storageKey).catch((error) => {
        this.logger.warn(
          `Failed to delete MinIO object "${storageKey}": ${
            error instanceof Error ? error.message : error
          }`,
        );
      });
    }

    await this.prisma.richMenu.delete({
      where: { id: menu.id },
    });

    this.logger.log(`Rich menu deleted: ${menu.id} for user ${userId}`);

    return { status: 'ok', id: menu.id };
  }

  async create(
    userId: string,
    dto: CreateRichMenuDto,
    imageBuffer: Buffer,
    contentType: string,
  ) {
    if (!imageBuffer?.length) {
      throw new BadRequestException('Rich menu image is required');
    }

    if (imageBuffer.length > 1024 * 1024) {
      throw new BadRequestException('Image must be 1 MB or smaller');
    }

    const layout = getLayoutById(dto.layoutId);

    if (dto.areas.length !== layout.cells.length) {
      throw new BadRequestException(
        `Expected ${layout.cells.length} areas for layout "${dto.layoutId}"`,
      );
    }

    const lineAccount =
      await this.lineAccountRepository.getLineAccountByUserId(userId);

    const channelAccessToken =
      lineAccount?.channelAccessToken ||
      this.configService.get<string>('LINE_BOT_CHANNEL_ACCESS_TOKEN');
    const channelSecret =
      lineAccount?.channelSecret ||
      this.configService.get<string>('LINE_BOT_CHANNEL_SECRET');

    if (!channelAccessToken || !channelSecret) {
      throw new BadRequestException('LINE credentials are not configured');
    }

    const mimeType = contentType.startsWith('image/')
      ? contentType
      : 'image/png';
    const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';
    const storageKey = this.storageService.buildKey(
      'rich-menu',
      `${userId}.${extension}`,
    );

    let imageUrl: string;
    try {
      const uploadResult = await this.storageService.upload(
        storageKey,
        imageBuffer,
        mimeType,
      );
      imageUrl = uploadResult.url;
    } catch (error) {
      this.logger.error(
        `Rich menu image upload failed for user ${userId}: ${
          error instanceof Error ? error.message : error
        }`,
      );
      throw new BadRequestException(
        'Failed to upload rich menu image to storage. Ensure MinIO is running.',
      );
    }

    const client = new line.Client({
      channelAccessToken,
      channelSecret,
    });

    const lineAreas = layout.cells.map((bounds, index) => ({
      bounds,
      action: this.buildLineAction(dto.areas[index]),
    }));

    let lineRichMenuId: string;
    try {
      lineRichMenuId = await client.createRichMenu({
        size: layout.size,
        selected: false,
        name: dto.name,
        chatBarText: dto.chatBarText,
        areas: lineAreas,
      });

      await client.setRichMenuImage(lineRichMenuId, imageBuffer, mimeType);

      if (dto.menuType === 'default') {
        await client.setDefaultRichMenu(lineRichMenuId);
      }
    } catch (error) {
      await this.storageService.delete(storageKey).catch((deleteError) => {
        this.logger.warn(
          `Failed to clean up MinIO object "${storageKey}": ${
            deleteError instanceof Error ? deleteError.message : deleteError
          }`,
        );
      });

      throw error;
    }

    if (lineAccount) {
      await this.prisma.richMenu.updateMany({
        where: {
          lineAccountId: lineAccount.id,
          menuType: dto.menuType,
          isActive: true,
        },
        data: { isActive: false },
      });
    }

    const savedMenu = lineAccount
      ? await this.prisma.richMenu.create({
          data: {
            lineAccountId: lineAccount.id,
            name: dto.name,
            imageUrl,
            lineRichMenuId,
            menuType: dto.menuType,
            chatBarText: dto.chatBarText,
            selected: false,
            sizeWidth: layout.size.width,
            sizeHeight: layout.size.height,
            areas: dto.areas as unknown as Prisma.InputJsonValue,
            isActive: true,
          },
        })
      : null;

    this.logger.log(
      `Rich menu created: ${lineRichMenuId} (${dto.menuType}) for user ${userId}`,
    );

    return {
      id: savedMenu?.id,
      lineRichMenuId,
      name: dto.name,
      menuType: dto.menuType,
      chatBarText: dto.chatBarText,
      layoutId: dto.layoutId,
      imageUrl,
      isActive: true,
      appliedAsDefault: dto.menuType === 'default',
    };
  }

  async applyMemberMenu(userId: string, richMenuId: string) {
    const lineAccount =
      await this.lineAccountRepository.getLineAccountByUserId(userId);

    if (!lineAccount) {
      throw new NotFoundException('LINE account not found');
    }

    const menu = await this.prisma.richMenu.findFirst({
      where: {
        id: richMenuId,
        lineAccountId: lineAccount.id,
        menuType: 'member',
      },
    });

    if (!menu?.lineRichMenuId) {
      throw new NotFoundException('Member rich menu not found');
    }

    const client = this.getLineClient(lineAccount);
    const lineUsers = await this.prisma.lineUser.findMany({
      where: { lineAccountId: lineAccount.id, status: 'following' },
    });

    let linkedCount = 0;
    for (const lineUser of lineUsers) {
      try {
        await client.linkRichMenuToUser(
          lineUser.lineUserId,
          menu.lineRichMenuId,
        );
        linkedCount += 1;
      } catch (error) {
        this.logger.warn(
          `Failed to link rich menu to ${lineUser.lineUserId}: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }

    await this.prisma.richMenu.updateMany({
      where: {
        lineAccountId: lineAccount.id,
        menuType: 'member',
        isActive: true,
      },
      data: { isActive: false },
    });

    await this.prisma.richMenu.update({
      where: { id: menu.id },
      data: { isActive: true },
    });

    return {
      status: 'ok',
      linkedCount,
      lineRichMenuId: menu.lineRichMenuId,
    };
  }

  private getLineClient(lineAccount: {
    channelAccessToken: string;
    channelSecret: string;
  }) {
    return new line.Client({
      channelAccessToken: lineAccount.channelAccessToken,
      channelSecret: lineAccount.channelSecret,
    });
  }

  private extractStorageKey(imageUrl: string | null | undefined): string | null {
    if (!imageUrl) {
      return null;
    }

    const bucket = this.configService.get<string>('MINIO_BUCKET', 'crm-lineoa');
    const marker = `/${bucket}/`;
    const markerIndex = imageUrl.indexOf(marker);

    if (markerIndex === -1) {
      return null;
    }

    return imageUrl.slice(markerIndex + marker.length);
  }

  private buildLineAction(
    area: CreateRichMenuDto['areas'][number],
  ): line.Action {
    switch (area.actionType) {
      case 'message':
        return {
          type: 'message',
          label: area.label,
          text: area.text || area.label,
        };
      case 'uri':
        if (!area.uri) {
          throw new BadRequestException(
            `URI is required for area "${area.label}"`,
          );
        }
        return {
          type: 'uri',
          label: area.label,
          uri: area.uri,
        };
      case 'datetimepicker':
        return {
          type: 'datetimepicker',
          label: area.label,
          data: area.data || 'datetime',
          mode: area.mode || 'datetime',
        };
      case 'postback':
      default:
        return {
          type: 'postback',
          label: area.label,
          data:
            area.data ||
            `action=${area.label.toLowerCase().replace(/\s+/g, '_')}`,
        };
    }
  }
}
