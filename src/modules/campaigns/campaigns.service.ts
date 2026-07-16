import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@Injectable()
export class CampaignsService {
  constructor(private prisma: PrismaService) {}

  async create(createCampaignDto: CreateCampaignDto, userId: string) {
    return await this.prisma.broadcast.create({
      data: {
        name: createCampaignDto.name,
        description: createCampaignDto.description,
        status: createCampaignDto.status || 'draft',
        scheduledFor: createCampaignDto.startDate ? new Date(createCampaignDto.startDate) : undefined,
        userId,
      },
    });
  }

  async findAll() {
    return await this.prisma.broadcast.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return await this.prisma.broadcast.findUnique({
      where: { id },
    });
  }

  async update(id: string, updateCampaignDto: UpdateCampaignDto) {
    return await this.prisma.broadcast.update({
      where: { id },
      data: updateCampaignDto,
    });
  }

  async remove(id: string) {
    return await this.prisma.broadcast.delete({
      where: { id },
    });
  }
}
