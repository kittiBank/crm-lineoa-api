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
import { AutoMessagesService } from './auto-messages.service';
import { CreateAutoMessageDto } from './dto/create-auto-message.dto';
import { UpdateAutoMessageDto } from './dto/update-auto-message.dto';

@ApiTags('Auto Messages')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('auto-messages')
export class AutoMessagesController {
  constructor(private readonly autoMessagesService: AutoMessagesService) {}

  @Get()
  @ApiOperation({ summary: 'List auto messages' })
  @ApiOkResponse({ description: 'Auto message list' })
  async findAll(@Request() req: { user: { id: string } }) {
    return this.autoMessagesService.findAll(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get auto message by ID' })
  @ApiOkResponse({ description: 'Auto message detail' })
  async findOne(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.autoMessagesService.findOne(req.user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create an auto message rule' })
  @ApiCreatedResponse({ description: 'Auto message created' })
  async create(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateAutoMessageDto,
  ) {
    return this.autoMessagesService.create(req.user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an auto message rule' })
  @ApiOkResponse({ description: 'Auto message updated' })
  async update(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateAutoMessageDto,
  ) {
    return this.autoMessagesService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an auto message rule' })
  @ApiOkResponse({ description: 'Auto message deleted' })
  async remove(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.autoMessagesService.remove(req.user.id, id);
  }
}
