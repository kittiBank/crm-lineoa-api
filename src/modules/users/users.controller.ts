import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiNotFoundResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all users',
    description: 'Retrieve list of all registered users (requires JWT token)',
  })
  @ApiOkResponse({
    description: 'List of users',
    schema: {
      example: [
        {
          id: 'clxxx123',
          email: 'user@example.com',
          name: 'John Doe',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - Invalid or missing token' })
  async findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get user by ID',
    description: 'Retrieve a specific user by their ID (requires JWT token)',
  })
  @ApiOkResponse({
    description: 'User found',
    schema: {
      example: {
        id: 'clxxx123',
        email: 'user@example.com',
        name: 'John Doe',
        createdAt: '2024-01-01T00:00:00Z',
      },
    },
  })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - Invalid or missing token' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }
}
