import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Delete,
  Patch,
  UseGuards,
  Request,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiAcceptedResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Broadcasts')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('broadcasts')
export class CampaignsController {
  constructor(private campaignsService: CampaignsService) {}

  @Get('audiences')
  @ApiOperation({ summary: 'Get broadcast audience options with counts' })
  @ApiOkResponse({ description: 'Audience options' })
  async getAudiences(@Request() req: { user: { id: string } }) {
    return this.campaignsService.getAudienceOptions(req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new broadcast' })
  @ApiCreatedResponse({ description: 'Broadcast created successfully' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - Invalid or missing token' })
  async create(
    @Request() req: { user: { id: string } },
    @Body() createCampaignDto: CreateCampaignDto,
  ) {
    return this.campaignsService.create(req.user.id, createCampaignDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all broadcasts' })
  @ApiOkResponse({ description: 'List of broadcasts' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - Invalid or missing token' })
  async findAll(@Request() req: { user: { id: string } }) {
    return this.campaignsService.findAll(req.user.id);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get broadcast dashboard stats' })
  @ApiOkResponse({ description: 'Broadcast stats' })
  async getStats(@Request() req: { user: { id: string } }) {
    return this.campaignsService.getStats(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get broadcast by ID' })
  @ApiOkResponse({ description: 'Broadcast details' })
  @ApiNotFoundResponse({ description: 'Broadcast not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - Invalid or missing token' })
  async findOne(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.campaignsService.findOne(req.user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update broadcast' })
  @ApiOkResponse({ description: 'Broadcast updated successfully' })
  @ApiNotFoundResponse({ description: 'Broadcast not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - Invalid or missing token' })
  async update(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() updateCampaignDto: UpdateCampaignDto,
  ) {
    return this.campaignsService.update(req.user.id, id, updateCampaignDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete broadcast' })
  @ApiOkResponse({ description: 'Broadcast deleted successfully' })
  @ApiNotFoundResponse({ description: 'Broadcast not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - Invalid or missing token' })
  async remove(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.campaignsService.remove(req.user.id, id);
  }

  @Post(':id/send')
  @HttpCode(202)
  @ApiOperation({ summary: 'Queue broadcast for sending' })
  @ApiAcceptedResponse({ description: 'Broadcast queued for sending' })
  @ApiNotFoundResponse({ description: 'Broadcast not found' })
  async sendNow(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.campaignsService.sendNow(req.user.id, id);
  }
}
