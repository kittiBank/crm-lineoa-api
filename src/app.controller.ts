import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Application is running',
    schema: {
      example: { message: 'CRM LINE OA API is running', timestamp: '2024-01-01T00:00:00Z' },
    },
  })
  getHello(): object {
    return this.appService.getHello();
  }
}
