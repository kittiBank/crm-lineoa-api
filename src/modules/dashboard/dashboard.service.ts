import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';
import {
  DASHBOARD_CACHE_TTL_SECONDS,
  dashboardOverviewCacheKey,
  dashboardOverviewCacheKeys,
} from './dashboard-cache';
import {
  DashboardPeriod,
  QueryDashboardDto,
} from './dto/query-dashboard.dto';

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

const STATUS_LABELS: Record<string, string> = {
  completed: 'Sent',
  processing: 'In Progress',
  scheduled: 'Scheduled',
  draft: 'Draft',
  failed: 'Failed',
};

const STATUS_ORDER = [
  'completed',
  'processing',
  'scheduled',
  'draft',
  'failed',
] as const;

type Range = {
  period: DashboardPeriod;
  start: Date;
  end: Date;
  granularity: 'hour' | 'day';
  bucketCount: number;
};

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async getOverview(userId: string, query: QueryDashboardDto) {
    const period = resolvePeriod(query);
    const cacheKey = dashboardOverviewCacheKey(userId, period);
    const cached = await this.redis.getJson<
      Awaited<ReturnType<DashboardService['buildOverview']>>
    >(cacheKey);
    if (cached) {
      return cached;
    }

    const overview = await this.buildOverview(userId, query);
    await this.redis.setJson(
      cacheKey,
      overview,
      DASHBOARD_CACHE_TTL_SECONDS,
    );
    return overview;
  }

  async invalidateOverviewCache(userId: string): Promise<void> {
    await this.redis.del(...dashboardOverviewCacheKeys(userId));
  }

  private async buildOverview(userId: string, query: QueryDashboardDto) {
    const range = resolveDashboardRange(query);
    const now = new Date();

    const lineAccount = await this.prisma.lineAccount.findUnique({
      where: { userId },
      select: { id: true },
    });

    const broadcastInRange = this.broadcastOccurredInRange(
      userId,
      range.start,
      range.end,
    );

    const [
      totalAudience,
      allFollowers,
      activeFollowers,
      activeBroadcasts,
      messageSent,
      statusGroups,
      trendBroadcasts,
      recentBroadcasts,
    ] = await Promise.all([
      lineAccount
        ? this.prisma.lineUser.count({
          where: {
            lineAccountId: lineAccount.id,
            status: 'following',
            OR: [
              { followedAt: { gte: range.start, lt: range.end } },
              {
                followedAt: null,
                createdAt: { gte: range.start, lt: range.end },
              },
            ],
          },
        })
        : 0,
      lineAccount
        ? this.prisma.lineUser.count({
          where: { lineAccountId: lineAccount.id, status: 'following' },
        })
        : 0,
      lineAccount
        ? this.prisma.lineUser.count({
          where: {
            lineAccountId: lineAccount.id,
            status: 'following',
            lastActivity: { gte: range.start, lt: range.end },
          },
        })
        : 0,
      this.prisma.broadcast.count({
        where: {
          ...broadcastInRange,
          status: { in: ['scheduled', 'processing'] },
        },
      }),
      this.prisma.broadcast.aggregate({
        where: {
          userId,
          sentAt: { gte: range.start, lt: range.end },
          status: { in: ['completed', 'processing'] },
        },
        _sum: { successCount: true },
      }),
      this.prisma.broadcast.groupBy({
        by: ['status'],
        where: broadcastInRange,
        _count: { _all: true },
      }),
      this.prisma.broadcast.findMany({
        where: {
          userId,
          sentAt: { gte: range.start, lt: range.end },
        },
        select: {
          sentAt: true,
          messageCount: true,
          successCount: true,
        },
      }),
      this.prisma.broadcast.findMany({
        where: broadcastInRange,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          messageCount: true,
          successCount: true,
          sentAt: true,
          scheduledFor: true,
          createdAt: true,
        },
      }),
    ]);

    const statusCountMap = new Map(
      statusGroups.map((group) => [group.status, group._count._all]),
    );

    return {
      period: range.period,
      range: {
        start: range.start.toISOString(),
        end: now.toISOString(),
      },
      metrics: {
        totalAudience,
        activeBroadcasts,
        messageSentToday: messageSent._sum.successCount ?? 0,
      },
      followers: {
        active: activeFollowers,
        inactive: Math.max(allFollowers - activeFollowers, 0),
      },
      broadcastTrend: this.buildTrend(trendBroadcasts, range),
      broadcastStatus: STATUS_ORDER.map((status) => ({
        name: STATUS_LABELS[status],
        value: statusCountMap.get(status) ?? 0,
      })),
      recentBroadcasts: recentBroadcasts.map((broadcast) => {
        const sent = broadcast.messageCount;
        const delivered = broadcast.successCount;
        const deliveredRate =
          sent > 0 ? Math.round((delivered / sent) * 1000) / 10 : 0;
        const date =
          broadcast.sentAt ?? broadcast.scheduledFor ?? broadcast.createdAt;

        return {
          id: broadcast.id,
          campaign: broadcast.name,
          description: broadcast.description,
          status: STATUS_LABELS[broadcast.status] ?? broadcast.status,
          sent,
          delivered,
          deliveredRate,
          date: date.toISOString(),
        };
      }),
    };
  }

  private broadcastOccurredInRange(
    userId: string,
    start: Date,
    end: Date,
  ): Prisma.BroadcastWhereInput {
    return {
      userId,
      OR: [
        { sentAt: { gte: start, lt: end } },
        {
          sentAt: null,
          scheduledFor: { gte: start, lt: end },
        },
        {
          sentAt: null,
          scheduledFor: null,
          createdAt: { gte: start, lt: end },
        },
      ],
    };
  }

  private buildTrend(
    broadcasts: {
      sentAt: Date | null;
      messageCount: number;
      successCount: number;
    }[],
    range: Range,
  ) {
    const buckets = new Map<number, { sent: number; delivered: number }>();
    const step =
      range.granularity === 'hour' ? MS_PER_HOUR : MS_PER_DAY;

    for (const broadcast of broadcasts) {
      if (!broadcast.sentAt) {
        continue;
      }

      const key =
        range.granularity === 'hour'
          ? startOfBangkokHour(broadcast.sentAt).getTime()
          : startOfBangkokDay(broadcast.sentAt).getTime();
      const current = buckets.get(key) ?? { sent: 0, delivered: 0 };
      current.sent += broadcast.messageCount;
      current.delivered += broadcast.successCount;
      buckets.set(key, current);
    }

    return Array.from({ length: range.bucketCount }, (_, index) => {
      const bucketStart = new Date(range.start.getTime() + index * step);
      const totals = buckets.get(bucketStart.getTime()) ?? {
        sent: 0,
        delivered: 0,
      };

      return {
        day: formatTrendLabel(bucketStart, range),
        sent: totals.sent,
        delivered: totals.delivered,
      };
    });
  }
}

export function resolveDashboardRange(query: QueryDashboardDto): Range {
  const period = resolvePeriod(query);
  const now = new Date();
  const todayStart = startOfBangkokDay(now);
  const rangeEnd = addDays(todayStart, 1);

  if (period === 'today') {
    return {
      period,
      start: todayStart,
      end: rangeEnd,
      granularity: 'hour',
      bucketCount: 24,
    };
  }

  if (period === '7d') {
    return {
      period,
      start: addDays(todayStart, -6),
      end: rangeEnd,
      granularity: 'day',
      bucketCount: 7,
    };
  }

  const monthStart = startOfBangkokMonth(now);
  const bucketCount =
    Math.round((todayStart.getTime() - monthStart.getTime()) / MS_PER_DAY) + 1;

  return {
    period,
    start: monthStart,
    end: rangeEnd,
    granularity: 'day',
    bucketCount,
  };
}

function resolvePeriod(query: QueryDashboardDto): DashboardPeriod {
  if (query.period) {
    return query.period;
  }

  if (query.days === 7) {
    return '7d';
  }

  if (query.days === 30 || query.days === 90) {
    return 'month';
  }

  return 'today';
}

function startOfBangkokDay(date: Date): Date {
  const bangkok = new Date(date.getTime() + BANGKOK_OFFSET_MS);
  return new Date(
    Date.UTC(
      bangkok.getUTCFullYear(),
      bangkok.getUTCMonth(),
      bangkok.getUTCDate(),
    ) - BANGKOK_OFFSET_MS,
  );
}

function startOfBangkokHour(date: Date): Date {
  const bangkok = new Date(date.getTime() + BANGKOK_OFFSET_MS);
  return new Date(
    Date.UTC(
      bangkok.getUTCFullYear(),
      bangkok.getUTCMonth(),
      bangkok.getUTCDate(),
      bangkok.getUTCHours(),
    ) - BANGKOK_OFFSET_MS,
  );
}

function startOfBangkokMonth(date: Date): Date {
  const bangkok = new Date(date.getTime() + BANGKOK_OFFSET_MS);
  return new Date(
    Date.UTC(bangkok.getUTCFullYear(), bangkok.getUTCMonth(), 1) -
    BANGKOK_OFFSET_MS,
  );
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function formatTrendLabel(bucketStart: Date, range: Range): string {
  if (range.granularity === 'hour') {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Bangkok',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(bucketStart);
  }

  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    ...(range.period === '7d'
      ? { weekday: 'short' }
      : { month: 'short', day: 'numeric' }),
  }).format(bucketStart);
}
