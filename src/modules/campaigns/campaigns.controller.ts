import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Delete,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Broadcasts/Campaigns')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('campaigns')
export class CampaignsController {
  constructor(private campaignsService: CampaignsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new campaign',
    description: 'Create a new broadcast campaign (requires JWT token)',
  })
  @ApiCreatedResponse({
    description: 'Campaign created successfully',
    schema: {
      example: {
        id: 'clxxx123',
        name: 'Summer Campaign 2024',
        status: 'draft',
        createdAt: '2024-01-01T00:00:00Z',
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - Invalid or missing token' })
  async create(@Body() createCampaignDto: CreateCampaignDto) {
    // TODO: Get actual userId from authenticated user
    return this.campaignsService.create(createCampaignDto, 'user-id');
  }

  @Get()
  @ApiOperation({
    summary: 'Get all campaigns',
    description: 'Retrieve list of all broadcast campaigns (requires JWT token)',
  })
  @ApiOkResponse({
    description: 'List of campaigns',
    schema: {
      example: [
        {
          id: 'clxxx123',
          name: 'Summer Campaign 2024',
          status: 'draft',
          messageCount: 100,
          createdAt: '2024-01-01T00:00:00Z',
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - Invalid or missing token' })
  async findAll() {
    return this.campaignsService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get campaign by ID',
    description: 'Retrieve details of a specific campaign (requires JWT token)',
  })
  @ApiOkResponse({
    description: 'Campaign details',
    schema: {
      example: {
        id: 'clxxx123',
        name: 'Summer Campaign 2024',
        description: 'A promotional campaign',
        status: 'draft',
        messageCount: 100,
        successCount: 95,
        failureCount: 5,
        createdAt: '2024-01-01T00:00:00Z',
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Campaign not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - Invalid or missing token' })
  async findOne(
    @Param('id') id: string,
  ) {
    return this.campaignsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update campaign',
    description: 'Update campaign details (requires JWT token)',
  })
  @ApiOkResponse({
    description: 'Campaign updated successfully',
  })
  @ApiNotFoundResponse({ description: 'Campaign not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - Invalid or missing token' })
  async update(
    @Param('id') id: string,
    @Body() updateCampaignDto: UpdateCampaignDto,
  ) {
    return this.campaignsService.update(id, updateCampaignDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete campaign',
    description: 'Delete a campaign (requires JWT token)',
  })
  @ApiOkResponse({
    description: 'Campaign deleted successfully',
  })
  @ApiNotFoundResponse({ description: 'Campaign not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - Invalid or missing token' })
  async remove(
    @Param('id') id: string,
  ) {
    return this.campaignsService.remove(id);
  }
}
