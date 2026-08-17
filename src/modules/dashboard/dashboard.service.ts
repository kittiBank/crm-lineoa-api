import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { DashboardTrendDays } from './dto/query-dashboard.dto';

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const ACTIVE_FOLLOWER_DAYS = 30;

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

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getOverview(userId: string, days: DashboardTrendDays = 7) {
    const now = new Date();
    const todayStart = startOfBangkokDay(now);
    const trendStart = addDays(todayStart, -(days - 1));
    const activeSince = addDays(now, -ACTIVE_FOLLOWER_DAYS);

    const lineAccount = await this.prisma.lineAccount.findUnique({
      where: { userId },
      select: { id: true },
    });

    const [
      totalAudience,
      activeFollowers,
      activeBroadcasts,
      messageSentToday,
      statusGroups,
      trendBroadcasts,
      recentBroadcasts,
    ] = await Promise.all([
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
              lastActivity: { gte: activeSince },
            },
          })
        : 0,
      this.prisma.broadcast.count({
        where: { userId, status: 'scheduled' },
      }),
      this.prisma.broadcast.aggregate({
        where: {
          userId,
          sentAt: { gte: todayStart },
          status: { in: ['completed', 'processing'] },
        },
        _sum: { successCount: true },
      }),
      this.prisma.broadcast.groupBy({
        by: ['status'],
        where: { userId },
        _count: { _all: true },
      }),
      this.prisma.broadcast.findMany({
        where: {
          userId,
          sentAt: { gte: trendStart },
        },
        select: {
          sentAt: true,
          messageCount: true,
          successCount: true,
        },
      }),
      this.prisma.broadcast.findMany({
        where: { userId },
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
      metrics: {
        totalAudience,
        activeBroadcasts,
        messageSentToday: messageSentToday._sum.successCount ?? 0,
      },
      followers: {
        active: activeFollowers,
        inactive: Math.max(totalAudience - activeFollowers, 0),
      },
      broadcastTrend: this.buildTrend(trendBroadcasts, days, todayStart),
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

  private buildTrend(
    broadcasts: {
      sentAt: Date | null;
      messageCount: number;
      successCount: number;
    }[],
    days: DashboardTrendDays,
    todayStart: Date,
  ) {
    const buckets = new Map<number, { sent: number; delivered: number }>();

    for (const broadcast of broadcasts) {
      if (!broadcast.sentAt) {
        continue;
      }

      const key = startOfBangkokDay(broadcast.sentAt).getTime();
      const current = buckets.get(key) ?? { sent: 0, delivered: 0 };
      current.sent += broadcast.messageCount;
      current.delivered += broadcast.successCount;
      buckets.set(key, current);
    }

    return Array.from({ length: days }, (_, index) => {
      const dayStart = addDays(todayStart, -(days - 1 - index));
      const totals = buckets.get(dayStart.getTime()) ?? {
        sent: 0,
        delivered: 0,
      };

      return {
        day: formatTrendLabel(dayStart, days),
        sent: totals.sent,
        delivered: totals.delivered,
      };
    });
  }
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

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function formatTrendLabel(dayStart: Date, days: DashboardTrendDays): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    ...(days <= 7 ? { weekday: 'short' } : { month: 'short', day: 'numeric' }),
  }).format(dayStart);
}
