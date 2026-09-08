import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LineService } from '@/modules/line/line.service';
import { isLineUserTier } from '@/modules/line/types/line-user-tier';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';
import {
  AUDIENCE_COUNT_CACHE_TTL_SECONDS,
  allFollowersCacheKey,
  audienceDbCountCacheKey,
} from './audience-followers-cache';
import {
  AudienceCriteriaDto,
  AudienceMatchMode,
  AudienceUserTier,
  AudienceUserType,
} from './dto/audience-criteria.dto';
import {
  AudienceSegmentType,
  CreateAudienceDto,
} from './dto/create-audience.dto';
import { EstimateAudienceDto } from './dto/estimate-audience.dto';
import { UpdateAudienceDto } from './dto/update-audience.dto';

type StoredCriteria = {
  match?: AudienceMatchMode;
  userTypes?: AudienceUserType[];
  userTiers?: AudienceUserTier[];
  activityDays?: number;
  newFollowerDays?: number;
};

@Injectable()
export class AudiencesService {
  private readonly countInflight = new Map<string, Promise<number>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly lineService: LineService,
    private readonly redis: RedisService,
  ) {}

  async findAll(userId: string) {
    const items = await this.prisma.audience.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const lineAccountId = await this.getLineAccountId(userId);
    return Promise.all(
      items.map((item) => this.toResponse(item, userId, lineAccountId)),
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
    return this.toResponse(item, userId, lineAccountId);
  }

  async estimate(userId: string, query: EstimateAudienceDto) {
    const criteria = this.normalizeAndValidateCriteria(query.type, query);
    const lineAccountId = await this.getLineAccountId(userId);
    const memberCount = await this.countMembers(
      userId,
      lineAccountId,
      query.type,
      criteria,
    );

    return {
      type: query.type,
      criteria,
      memberCount,
    };
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
    return this.toResponse(item, userId, lineAccountId);
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
    return this.toResponse(item, userId, lineAccountId);
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
   * Type `all` uses LINE Insight. Other counts come from `line_users`.
   * All are Redis-cached for 5 minutes.
   */
  async countMembers(
    userId: string,
    lineAccountId: string | null,
    type: AudienceSegmentType,
    criteria: StoredCriteria,
  ): Promise<number> {
    if (!lineAccountId) {
      return 0;
    }

    if (type === 'all') {
      return this.getCachedCount(allFollowersCacheKey(lineAccountId), () =>
        this.lineService.getFollowerCountForUser(userId),
      );
    }

    const where = this.buildRecipientWhere(lineAccountId, type, criteria);
    if (!where) {
      return 0;
    }

    if (
      type === 'active' ||
      type === 'new' ||
      type === 'user_type' ||
      type === 'combined'
    ) {
      return this.getCachedCount(
        audienceDbCountCacheKey(
          lineAccountId,
          type,
          this.dbCountCacheSuffix(type, criteria),
        ),
        () => this.prisma.lineUser.count({ where }),
      );
    }

    return this.prisma.lineUser.count({ where });
  }

  private dbCountCacheSuffix(
    type: 'active' | 'new' | 'user_type' | 'combined',
    criteria: StoredCriteria,
  ): string {
    if (type === 'active') {
      return String(criteria.activityDays ?? 30);
    }

    if (type === 'new') {
      return String(criteria.newFollowerDays ?? 7);
    }

    if (type === 'combined') {
      const match = criteria.match === 'or' ? 'or' : 'and';
      const userTypes = [...(criteria.userTypes ?? [])].sort().join(',');
      const userTiers =
        [...(criteria.userTiers ?? [])].sort().join(',') || 'all';
      return [
        match,
        userTypes || '-',
        userTiers,
        String(criteria.activityDays ?? '-'),
        String(criteria.newFollowerDays ?? '-'),
      ].join(':');
    }

    const userTypes = [...(criteria.userTypes ?? [])].sort().join(',');
    const userTiers = [...(criteria.userTiers ?? [])].sort().join(',') || 'all';
    return `${userTypes}:${userTiers}`;
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
        const clause = this.buildUserTypeClause(criteria);
        if (!clause) {
          return null;
        }
        return { ...base, ...clause };
      }
      case 'active': {
        const clause = this.buildActiveClause(criteria);
        if (!clause) {
          return null;
        }
        return { ...base, ...clause };
      }
      case 'new': {
        const clause = this.buildNewClause(criteria);
        if (!clause) {
          return null;
        }
        return { ...base, ...clause };
      }
      case 'combined': {
        const clauses = [
          this.buildUserTypeClause(criteria),
          this.buildActiveClause(criteria),
          this.buildNewClause(criteria),
        ].filter((clause): clause is Prisma.LineUserWhereInput =>
          Boolean(clause),
        );

        if (clauses.length === 0) {
          return null;
        }
        if (clauses.length === 1) {
          return { ...base, ...clauses[0] };
        }
        if (criteria.match === 'or') {
          return { ...base, OR: clauses };
        }
        return { ...base, AND: clauses };
      }
      case 'segment':
        return null;
      default:
        return base;
    }
  }

  private buildUserTypeClause(
    criteria: StoredCriteria,
  ): Prisma.LineUserWhereInput | null {
    const userTypes = (criteria.userTypes ?? []).filter(
      (value) => value === 'Member' || value === 'Guest',
    );
    if (userTypes.length === 0) {
      return null;
    }

    const userTiers = (criteria.userTiers ?? []).filter(isLineUserTier);

    return {
      userType: { in: userTypes },
      ...(userTiers.length > 0 ? { userTier: { in: userTiers } } : {}),
    };
  }

  private buildActiveClause(
    criteria: StoredCriteria,
  ): Prisma.LineUserWhereInput | null {
    if (!criteria.activityDays || criteria.activityDays < 1) {
      return null;
    }

    const since = new Date();
    since.setDate(since.getDate() - criteria.activityDays);
    return { lastActivity: { gte: since } };
  }

  private buildNewClause(
    criteria: StoredCriteria,
  ): Prisma.LineUserWhereInput | null {
    if (!criteria.newFollowerDays || criteria.newFollowerDays < 1) {
      return null;
    }

    const since = new Date();
    since.setDate(since.getDate() - criteria.newFollowerDays);
    return { followedAt: { gte: since } };
  }

  private normalizeAndValidateCriteria(
    type: AudienceSegmentType,
    criteria: AudienceCriteriaDto | StoredCriteria,
  ): StoredCriteria {
    if (type === 'segment') {
      throw new BadRequestException('Custom segments are not available yet');
    }

    if (type === 'user_type') {
      return this.normalizeUserTypeCriteria(criteria);
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

    if (type === 'combined') {
      return this.normalizeCombinedCriteria(criteria);
    }

    return {};
  }

  private normalizeUserTypeCriteria(
    criteria: AudienceCriteriaDto | StoredCriteria,
  ): StoredCriteria {
    const supported = (criteria.userTypes ?? []).filter(
      (value) => value === 'Member' || value === 'Guest',
    );
    if (supported.length === 0) {
      throw new BadRequestException(
        'Select at least one user type (Member or Guest)',
      );
    }

    const userTiers = (criteria.userTiers ?? []).filter(isLineUserTier);

    return {
      userTypes: supported,
      ...(userTiers.length > 0 ? { userTiers } : {}),
    };
  }

  private normalizeCombinedCriteria(
    criteria: AudienceCriteriaDto | StoredCriteria,
  ): StoredCriteria {
    const match: AudienceMatchMode = criteria.match === 'or' ? 'or' : 'and';
    const result: StoredCriteria = { match };
    let groupCount = 0;

    const hasUserTypes = (criteria.userTypes ?? []).length > 0;
    if (hasUserTypes) {
      Object.assign(result, this.normalizeUserTypeCriteria(criteria));
      groupCount += 1;
    }

    if (criteria.activityDays) {
      if (criteria.activityDays < 1) {
        throw new BadRequestException(
          'activityDays must be at least 1 for combined audiences',
        );
      }
      result.activityDays = criteria.activityDays;
      groupCount += 1;
    }

    if (criteria.newFollowerDays) {
      if (criteria.newFollowerDays < 1) {
        throw new BadRequestException(
          'newFollowerDays must be at least 1 for combined audiences',
        );
      }
      result.newFollowerDays = criteria.newFollowerDays;
      groupCount += 1;
    }

    if (groupCount < 2) {
      throw new BadRequestException(
        'Combined audiences require at least two targeting rules',
      );
    }

    return result;
  }

  private parseCriteria(value: Prisma.JsonValue): StoredCriteria {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    const record = value as Record<string, unknown>;
    const criteria: StoredCriteria = {};

    if (record.match === 'and' || record.match === 'or') {
      criteria.match = record.match;
    }

    if (Array.isArray(record.userTypes)) {
      criteria.userTypes = record.userTypes.filter(
        (item): item is AudienceUserType =>
          item === 'Member' || item === 'Guest',
      );
    }

    if (Array.isArray(record.userTiers)) {
      criteria.userTiers = record.userTiers.filter(isLineUserTier);
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

  private async getCachedCount(
    cacheKey: string,
    loader: () => Promise<number>,
  ): Promise<number> {
    const inflight = this.countInflight.get(cacheKey);
    if (inflight) {
      return inflight;
    }

    const promise = this.loadCachedCount(cacheKey, loader).finally(() => {
      this.countInflight.delete(cacheKey);
    });

    this.countInflight.set(cacheKey, promise);
    return promise;
  }

  private async loadCachedCount(
    cacheKey: string,
    loader: () => Promise<number>,
  ): Promise<number> {
    const cached = await this.redis.getJson<{ memberCount: number }>(cacheKey);
    if (cached && typeof cached.memberCount === 'number') {
      return cached.memberCount;
    }

    const memberCount = await loader();
    await this.redis.setJson(
      cacheKey,
      { memberCount },
      AUDIENCE_COUNT_CACHE_TTL_SECONDS,
    );
    return memberCount;
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
    userId: string,
    lineAccountId: string | null,
  ) {
    const type = item.type as AudienceSegmentType;
    const criteria = this.parseCriteria(item.criteria);
    const memberCount = await this.countMembers(
      userId,
      lineAccountId,
      type,
      criteria,
    );

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
