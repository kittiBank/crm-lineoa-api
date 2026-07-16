import { Controller, Get, Post, Param, Body, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Messages')
@ApiBearerAuth()
@Controller('messages')
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Create a new message' })
  async create(@Body() createMessageDto: CreateMessageDto) {
    return this.messagesService.create(createMessageDto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get all messages' })
  async findAll(@Query('lineUserId') lineUserId?: string) {
    return this.messagesService.findAll(lineUserId);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get message by ID' })
  async findOne(@Param('id') id: string) {
    return this.messagesService.findOne(id);
  }

  @Post(':id/read')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Mark message as read' })
  async markAsRead(@Param('id') id: string) {
    return this.messagesService.markAsRead(id);
  }
}
