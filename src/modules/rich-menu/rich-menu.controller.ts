import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RichMenuService } from './rich-menu.service';
import { CreateRichMenuDto } from './dto/create-rich-menu.dto';
import { RICH_MENU_LAYOUTS } from './constants/layouts';

@ApiTags('Rich Menu')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('rich-menus')
export class RichMenuController {
  constructor(private readonly richMenuService: RichMenuService) {}

  @Get('layouts')
  @ApiOperation({ summary: 'Get available rich menu layout templates' })
  @ApiOkResponse({ description: 'Layout templates' })
  async getLayouts() {
    return RICH_MENU_LAYOUTS.map(({ id, label, description, size, rows, cols }) => ({
      id,
      label,
      description,
      size,
      rows,
      cols,
    }));
  }

  @Get()
  @ApiOperation({ summary: 'List rich menus for the authenticated user' })
  @ApiOkResponse({ description: 'Rich menu list' })
  async findAll(@Request() req: { user: { id: string } }) {
    return this.richMenuService.findAll(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a rich menu by ID' })
  @ApiOkResponse({ description: 'Rich menu detail' })
  async findOne(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.richMenuService.findOne(req.user.id, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a rich menu' })
  @ApiOkResponse({ description: 'Rich menu deleted' })
  async remove(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.richMenuService.remove(req.user.id, id);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Create and publish a rich menu',
    description:
      'Uploads image to MinIO, creates a rich menu on LINE, and sets as default (guest) when menuType is default',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'menuType', 'chatBarText', 'layoutId', 'areas', 'image'],
      properties: {
        name: { type: 'string', example: 'Default Guest Menu' },
        menuType: { type: 'string', enum: ['default', 'member'] },
        chatBarText: { type: 'string', example: 'Menu' },
        layoutId: { type: 'string', example: 'large-2x3' },
        areas: {
          type: 'string',
          description: 'JSON string of area action configs',
        },
        image: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Rich menu created successfully' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async create(
    @Request() req: { user: { id: string } },
    @UploadedFile() image: { buffer: Buffer; mimetype: string } | undefined,
    @Body() body: Record<string, string>,
  ) {
    let areas: CreateRichMenuDto['areas'];
    try {
      areas = JSON.parse(body.areas || '[]');
    } catch {
      throw new BadRequestException('Invalid areas JSON');
    }

    const dto: CreateRichMenuDto = {
      name: body.name,
      menuType: body.menuType as CreateRichMenuDto['menuType'],
      chatBarText: body.chatBarText,
      layoutId: body.layoutId,
      areas,
    };

    return this.richMenuService.create(
      req.user.id,
      dto,
      image?.buffer ?? Buffer.alloc(0),
      image?.mimetype || 'image/png',
    );
  }

  @Post(':id/apply-member')
  @ApiOperation({
    summary: 'Link member rich menu to all following LINE users',
  })
  @ApiOkResponse({ description: 'Member rich menu linked' })
  async applyMemberMenu(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.richMenuService.applyMemberMenu(req.user.id, id);
  }
}
