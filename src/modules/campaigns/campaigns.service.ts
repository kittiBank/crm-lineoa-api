import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { BroadcastQueueService } from '@/queue/broadcast-queue.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

const EDITABLE_STATUSES = new Set(['draft', 'scheduled']);
const DELETABLE_STATUSES = new Set(['draft', 'scheduled']);
const AUDIENCE_TYPES = new Set(['all', 'active', 'new']);

@Injectable()
export class CampaignsService {
  constructor(
    private prisma: PrismaService,
    private broadcastQueueService: BroadcastQueueService,
  ) {}

  async create(userId: string, createCampaignDto: CreateCampaignDto) {
    await this.ensureTemplateExists(userId, createCampaignDto.templateId);

    const status = createCampaignDto.status ?? 'draft';
    if (status === 'scheduled' && !createCampaignDto.scheduledFor) {
      throw new BadRequestException(
        'scheduledFor is required when status is scheduled',
      );
    }

    if (
      status === 'scheduled' &&
      new Date(createCampaignDto.scheduledFor!).getTime() <= Date.now()
    ) {
      throw new BadRequestException('scheduledFor must be in the future');
    }

    const broadcast = await this.prisma.broadcast.create({
      data: {
        userId,
        name: createCampaignDto.name,
        description: createCampaignDto.description,
        templateId: createCampaignDto.templateId,
        audienceType: createCampaignDto.audienceType ?? 'all',
        status,
        scheduledFor: createCampaignDto.scheduledFor
          ? new Date(createCampaignDto.scheduledFor)
          : undefined,
        sentAt: status === 'processing' ? new Date() : undefined,
      },
      include: this.defaultInclude(),
    });

    if (status === 'processing') {
      await this.queueBroadcast(userId, broadcast.id);
      return this.toResponse(
        await this.prisma.broadcast.findUniqueOrThrow({
          where: { id: broadcast.id },
          include: this.defaultInclude(),
        }),
      );
    }

    return this.toResponse(broadcast);
  }

  async findAll(userId: string) {
    const broadcasts = await this.prisma.broadcast.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: this.defaultInclude(),
    });

    return broadcasts.map((broadcast) => this.toResponse(broadcast));
  }

  async findOne(userId: string, id: string) {
    const broadcast = await this.prisma.broadcast.findFirst({
      where: { id, userId },
      include: this.defaultInclude(),
    });

    if (!broadcast) {
      throw new NotFoundException('Broadcast not found');
    }

    return this.toResponse(broadcast);
  }

  async update(userId: string, id: string, updateCampaignDto: UpdateCampaignDto) {
    const existing = await this.findOne(userId, id);

    if (!EDITABLE_STATUSES.has(existing.status)) {
      throw new BadRequestException(
        'Only draft or scheduled broadcasts can be updated',
      );
    }

    if (updateCampaignDto.templateId) {
      await this.ensureTemplateExists(userId, updateCampaignDto.templateId);
    }

    if (
      updateCampaignDto.status === 'scheduled' &&
      !updateCampaignDto.scheduledFor
    ) {
      throw new BadRequestException(
        'scheduledFor is required when status is scheduled',
      );
    }

    const nextStatus = updateCampaignDto.status ?? existing.status;

    const broadcast = await this.prisma.broadcast.update({
      where: { id },
      data: {
        name: updateCampaignDto.name,
        description: updateCampaignDto.description,
        templateId: updateCampaignDto.templateId,
        audienceType: updateCampaignDto.audienceType,
        status: updateCampaignDto.status,
        scheduledFor:
          updateCampaignDto.scheduledFor === null
            ? null
            : updateCampaignDto.scheduledFor
              ? new Date(updateCampaignDto.scheduledFor)
              : undefined,
        sentAt: nextStatus === 'processing' ? new Date() : undefined,
      },
      include: this.defaultInclude(),
    });

    if (nextStatus === 'processing') {
      await this.queueBroadcast(userId, id);
    }

    return this.toResponse(broadcast);
  }

  async remove(userId: string, id: string) {
    const existing = await this.findOne(userId, id);

    if (!DELETABLE_STATUSES.has(existing.status)) {
      throw new BadRequestException(
        'Only draft or scheduled broadcasts can be deleted',
      );
    }

    await this.prisma.broadcast.delete({
      where: { id },
    });

    return { status: 'ok', id };
  }

  async sendNow(userId: string, id: string) {
    const broadcast = await this.findOne(userId, id);

    if (broadcast.status === 'completed') {
      throw new BadRequestException('Broadcast has already been sent');
    }

    await this.prisma.broadcast.update({
      where: { id },
      data: {
        status: 'processing',
        sentAt: new Date(),
        scheduledFor: null,
      },
    });

    await this.queueBroadcast(userId, id);

    return this.findOne(userId, id);
  }

  private async queueBroadcast(userId: string, broadcastId: string) {
    await this.broadcastQueueService.enqueue({ broadcastId, userId });
  }

  async getStats(userId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
      999,
    );

    const [
      currentMonthSent,
      lastMonthSent,
      activeScheduled,
      nextScheduled,
      completedThisMonth,
      completedLastMonth,
    ] = await Promise.all([
      this.prisma.broadcast.aggregate({
        where: {
          userId,
          status: 'completed',
          sentAt: { gte: startOfMonth },
        },
        _sum: { successCount: true },
      }),
      this.prisma.broadcast.aggregate({
        where: {
          userId,
          status: 'completed',
          sentAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
        _sum: { successCount: true },
      }),
      this.prisma.broadcast.count({
        where: { userId, status: 'scheduled' },
      }),
      this.prisma.broadcast.findFirst({
        where: {
          userId,
          status: 'scheduled',
          scheduledFor: { gt: now },
        },
        orderBy: { scheduledFor: 'asc' },
        select: { scheduledFor: true },
      }),
      this.prisma.broadcast.findMany({
        where: {
          userId,
          status: 'completed',
          sentAt: { gte: startOfMonth },
          messageCount: { gt: 0 },
        },
        select: { messageCount: true, successCount: true },
      }),
      this.prisma.broadcast.findMany({
        where: {
          userId,
          status: 'completed',
          sentAt: { gte: startOfLastMonth, lte: endOfLastMonth },
          messageCount: { gt: 0 },
        },
        select: { messageCount: true, successCount: true },
      }),
    ]);

    const totalSentThisMonth = currentMonthSent._sum.successCount ?? 0;
    const totalSentLastMonth = lastMonthSent._sum.successCount ?? 0;

    let percentageChange = 0;
    if (totalSentLastMonth > 0) {
      percentageChange =
        Math.round(
          ((totalSentThisMonth - totalSentLastMonth) / totalSentLastMonth) *
            100 *
            10,
        ) / 10;
    } else if (totalSentThisMonth > 0) {
      percentageChange = 100;
    }

    const averageReadRate = this.averageDeliveryRate(completedThisMonth);
    const readRateLastMonth = this.averageDeliveryRate(completedLastMonth);
    let readRatePercentageChange = 0;
    if (readRateLastMonth > 0) {
      readRatePercentageChange =
        Math.round((averageReadRate - readRateLastMonth) * 10) / 10;
    } else if (averageReadRate > 0) {
      readRatePercentageChange = averageReadRate;
    }

    return {
      totalSentThisMonth,
      percentageChange,
      averageReadRate,
      readRatePercentageChange,
      activeScheduled,
      nextBroadcastAt: nextScheduled?.scheduledFor?.toISOString() ?? null,
    };
  }

  async getAudienceOptions(userId: string) {
    const lineAccount = await this.prisma.lineAccount.findUnique({
      where: { userId },
    });

    if (!lineAccount) {
      return [
        { value: 'all', label: 'All Followers', count: 0 },
        { value: 'active', label: 'Active Users', count: 0 },
        { value: 'new', label: 'New Followers', count: 0 },
      ];
    }

    const now = new Date();
    const activeSince = new Date(now);
    activeSince.setDate(activeSince.getDate() - 30);
    const newSince = new Date(now);
    newSince.setDate(newSince.getDate() - 7);

    const baseWhere = {
      lineAccountId: lineAccount.id,
      status: 'following',
    };

    const [allCount, activeCount, newCount] = await Promise.all([
      this.prisma.lineUser.count({ where: baseWhere }),
      this.prisma.lineUser.count({
        where: {
          ...baseWhere,
          lastActivity: { gte: activeSince },
        },
      }),
      this.prisma.lineUser.count({
        where: {
          ...baseWhere,
          followedAt: { gte: newSince },
        },
      }),
    ]);

    return [
      {
        value: 'all',
        label: 'All Followers',
        description: 'Send to everyone following your LINE OA',
        count: allCount,
      },
      {
        value: 'active',
        label: 'Active Users',
        description: 'Users active in the last 30 days',
        count: activeCount,
      },
      {
        value: 'new',
        label: 'New Followers',
        description: 'Users who followed in the last 7 days',
        count: newCount,
      },
    ];
  }

  private async ensureTemplateExists(userId: string, templateId: string) {
    const template = await this.prisma.messageTemplate.findFirst({
      where: { id: templateId, userId, isActive: true },
    });

    if (!template) {
      throw new NotFoundException('Message template not found');
    }
  }

  private defaultInclude() {
    return {
      template: {
        select: {
          id: true,
          name: true,
          messageType: true,
        },
      },
    };
  }

  private averageDeliveryRate(
    broadcasts: { messageCount: number; successCount: number }[],
  ): number {
    if (broadcasts.length === 0) {
      return 0;
    }

    const totalRate = broadcasts.reduce((sum, broadcast) => {
      return sum + (broadcast.successCount / broadcast.messageCount) * 100;
    }, 0);

    return Math.round((totalRate / broadcasts.length) * 10) / 10;
  }

  private toResponse(
    broadcast: {
      id: string;
      name: string;
      description: string | null;
      audienceType: string;
      status: string;
      messageCount: number;
      successCount: number;
      failureCount: number;
      scheduledFor: Date | null;
      sentAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      templateId: string | null;
      template?: {
        id: string;
        name: string;
        messageType: string;
      } | null;
    },
  ) {
    const audienceType = AUDIENCE_TYPES.has(broadcast.audienceType)
      ? broadcast.audienceType
      : 'all';

    return {
      id: broadcast.id,
      name: broadcast.name,
      description: broadcast.description,
      audienceType,
      status: broadcast.status,
      messageCount: broadcast.messageCount,
      successCount: broadcast.successCount,
      failureCount: broadcast.failureCount,
      scheduledFor: broadcast.scheduledFor?.toISOString() ?? null,
      sentAt: broadcast.sentAt?.toISOString() ?? null,
      createdAt: broadcast.createdAt.toISOString(),
      updatedAt: broadcast.updatedAt.toISOString(),
      templateId: broadcast.templateId,
      template: broadcast.template
        ? {
            id: broadcast.template.id,
            name: broadcast.template.name,
            type: broadcast.template.messageType,
          }
        : null,
    };
  }
}
