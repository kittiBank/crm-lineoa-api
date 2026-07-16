import { Controller, Get, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Authentication')
@Controller('auth')
export class ProfileController {
  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved',
    schema: {
      example: {
        id: 'user-id',
        email: 'user@example.com',
        name: 'John Doe',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  getProfile(@Request() req: any) {
    if (!req.user) {
      throw new BadRequestException('User not found in request context');
    }
    return {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      message: 'JWT token is valid ✓',
    };
  }
}
