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
import { TemplatesService } from './templates.service';
import { CreateMessageTemplateDto } from './dto/create-message-template.dto';
import { UpdateMessageTemplateDto } from './dto/update-message-template.dto';

@ApiTags('Message Templates')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'List message templates for authenticated user' })
  @ApiOkResponse({ description: 'Template list' })
  async findAll(@Request() req: { user: { id: string } }) {
    return this.templatesService.findAll(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get message template by ID' })
  @ApiOkResponse({ description: 'Template detail' })
  async findOne(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.templatesService.findOne(req.user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a message template' })
  @ApiCreatedResponse({ description: 'Template created' })
  async create(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateMessageTemplateDto,
  ) {
    return this.templatesService.create(req.user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a message template' })
  @ApiOkResponse({ description: 'Template updated' })
  async update(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateMessageTemplateDto,
  ) {
    return this.templatesService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a message template' })
  @ApiOkResponse({ description: 'Template deleted' })
  async remove(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.templatesService.remove(req.user.id, id);
  }
}
