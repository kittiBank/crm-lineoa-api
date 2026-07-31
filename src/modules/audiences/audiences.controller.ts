import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AudiencesService } from './audiences.service';
import { CreateAudienceDto } from './dto/create-audience.dto';
import { UpdateAudienceDto } from './dto/update-audience.dto';

@ApiTags('Audiences')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('audiences')
export class AudiencesController {
  constructor(private readonly audiencesService: AudiencesService) {}

  @Get()
  @ApiOperation({ summary: 'List audiences' })
  @ApiOkResponse({ description: 'Audience list' })
  async findAll(@Request() req: { user: { id: string } }) {
    return this.audiencesService.findAll(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get audience by ID' })
  @ApiOkResponse({ description: 'Audience detail' })
  async findOne(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.audiencesService.findOne(req.user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create an audience segment' })
  @ApiCreatedResponse({ description: 'Audience created' })
  async create(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateAudienceDto,
  ) {
    return this.audiencesService.create(req.user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an audience segment' })
  @ApiOkResponse({ description: 'Audience updated' })
  async update(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateAudienceDto,
  ) {
    return this.audiencesService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an audience segment' })
  @ApiOkResponse({ description: 'Audience deleted' })
  async remove(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.audiencesService.remove(req.user.id, id);
  }
}
