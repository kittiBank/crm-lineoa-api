import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  AudienceCriteriaDto,
  AudienceUserType,
} from './dto/audience-criteria.dto';
import {
  AudienceSegmentType,
  CreateAudienceDto,
} from './dto/create-audience.dto';
import { UpdateAudienceDto } from './dto/update-audience.dto';

type StoredCriteria = {
  userTypes?: AudienceUserType[];
  activityDays?: number;
  newFollowerDays?: number;
};

@Injectable()
export class AudiencesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    const items = await this.prisma.audience.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const lineAccountId = await this.getLineAccountId(userId);
    return Promise.all(
      items.map((item) => this.toResponse(item, lineAccountId)),
    );
  }

  async findOne(userId: string, id: string) {
    const item = await this.prisma.audience.findFirst({
      where: { id, userId },
    });

    if (!item) {
      throw new NotFoundException('Audience not found');
    }

    const lineAccountId = await this.getLineAccountId(userId);
    return this.toResponse(item, lineAccountId);
  }

  async create(userId: string, dto: CreateAudienceDto) {
    const criteria = this.normalizeAndValidateCriteria(dto.type, dto.criteria);

    const item = await this.prisma.audience.create({
      data: {
        userId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        type: dto.type,
        criteria: criteria as Prisma.InputJsonValue,
        isActive: dto.isActive ?? true,
      },
    });

    const lineAccountId = await this.getLineAccountId(userId);
    return this.toResponse(item, lineAccountId);
  }

  async update(userId: string, id: string, dto: UpdateAudienceDto) {
    const existing = await this.prisma.audience.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException('Audience not found');
    }

    const nextType = (dto.type ?? existing.type) as AudienceSegmentType;
    const nextCriteria =
      dto.criteria !== undefined
        ? this.normalizeAndValidateCriteria(nextType, dto.criteria)
        : this.normalizeAndValidateCriteria(
            nextType,
            this.parseCriteria(existing.criteria),
          );

    const item = await this.prisma.audience.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description:
          dto.description === undefined
            ? undefined
            : dto.description?.trim() || null,
        type: dto.type,
        criteria:
          dto.criteria !== undefined || dto.type !== undefined
            ? (nextCriteria as Prisma.InputJsonValue)
            : undefined,
        isActive: dto.isActive,
      },
    });

    const lineAccountId = await this.getLineAccountId(userId);
    return this.toResponse(item, lineAccountId);
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.audience.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException('Audience not found');
    }

    await this.prisma.audience.delete({
      where: { id },
    });

    return { status: 'ok', id };
  }

  /**
   * Count following LINE users matching the audience segment rules.
   * VIP is ignored until VIP import is implemented.
   */
  async countMembers(
    lineAccountId: string | null,
    type: AudienceSegmentType,
    criteria: StoredCriteria,
  ): Promise<number> {
    if (!lineAccountId) {
      return 0;
    }

    const where = this.buildRecipientWhere(lineAccountId, type, criteria);
    if (!where) {
      return 0;
    }

    return this.prisma.lineUser.count({ where });
  }

  buildRecipientWhere(
    lineAccountId: string,
    type: AudienceSegmentType,
    criteria: StoredCriteria,
  ): Prisma.LineUserWhereInput | null {
    const base: Prisma.LineUserWhereInput = {
      lineAccountId,
      status: 'following',
    };

    switch (type) {
      case 'all':
        return base;
      case 'user_type': {
        const userTypes = (criteria.userTypes ?? []).filter(
          (value) => value === 'Member' || value === 'Guest',
        );
        if (userTypes.length === 0) {
          return null;
        }
        return {
          ...base,
          userType: { in: userTypes },
        };
      }
      case 'active': {
        const days = criteria.activityDays ?? 30;
        const since = new Date();
        since.setDate(since.getDate() - days);
        return {
          ...base,
          lastActivity: { gte: since },
        };
      }
      case 'new': {
        const days = criteria.newFollowerDays ?? 7;
        const since = new Date();
        since.setDate(since.getDate() - days);
        return {
          ...base,
          followedAt: { gte: since },
        };
      }
      case 'segment':
        return null;
      default:
        return base;
    }
  }

  private normalizeAndValidateCriteria(
    type: AudienceSegmentType,
    criteria: AudienceCriteriaDto | StoredCriteria,
  ): StoredCriteria {
    if (type === 'segment') {
      throw new BadRequestException('Custom segments are not available yet');
    }

    const userTypes = criteria.userTypes ?? [];
    if (userTypes.includes('VIP')) {
      throw new BadRequestException('VIP targeting is not available yet');
    }

    if (type === 'user_type') {
      const supported = userTypes.filter(
        (value) => value === 'Member' || value === 'Guest',
      );
      if (supported.length === 0) {
        throw new BadRequestException(
          'Select at least one user type (Member or Guest)',
        );
      }
      return { userTypes: supported };
    }

    if (type === 'active') {
      if (!criteria.activityDays || criteria.activityDays < 1) {
        throw new BadRequestException(
          'activityDays is required for active audiences',
        );
      }
      return { activityDays: criteria.activityDays };
    }

    if (type === 'new') {
      if (!criteria.newFollowerDays || criteria.newFollowerDays < 1) {
        throw new BadRequestException(
          'newFollowerDays is required for new audiences',
        );
      }
      return { newFollowerDays: criteria.newFollowerDays };
    }

    // type = all
    return {};
  }

  private parseCriteria(value: Prisma.JsonValue): StoredCriteria {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    const record = value as Record<string, unknown>;
    const criteria: StoredCriteria = {};

    if (Array.isArray(record.userTypes)) {
      criteria.userTypes = record.userTypes.filter(
        (item): item is AudienceUserType =>
          item === 'Member' || item === 'Guest' || item === 'VIP',
      );
    }

    if (typeof record.activityDays === 'number') {
      criteria.activityDays = record.activityDays;
    }

    if (typeof record.newFollowerDays === 'number') {
      criteria.newFollowerDays = record.newFollowerDays;
    }

    return criteria;
  }

  private async getLineAccountId(userId: string): Promise<string | null> {
    const lineAccount = await this.prisma.lineAccount.findUnique({
      where: { userId },
      select: { id: true },
    });
    return lineAccount?.id ?? null;
  }

  private async toResponse(
    item: {
      id: string;
      name: string;
      description: string | null;
      type: string;
      criteria: Prisma.JsonValue;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    },
    lineAccountId: string | null,
  ) {
    const type = item.type as AudienceSegmentType;
    const criteria = this.parseCriteria(item.criteria);
    const memberCount = await this.countMembers(lineAccountId, type, criteria);

    return {
      id: item.id,
      name: item.name,
      description: item.description,
      type,
      criteria,
      memberCount,
      isActive: item.isActive,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}
