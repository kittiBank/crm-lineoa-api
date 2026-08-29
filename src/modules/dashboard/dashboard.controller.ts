import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { DashboardService } from './dashboard.service';
import { QueryDashboardDto } from './dto/query-dashboard.dto';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Get dashboard overview stats' })
  @ApiOkResponse({ description: 'Dashboard overview' })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Invalid or missing token',
  })
  async getOverview(
    @Request() req: { user: { id: string } },
    @Query() query: QueryDashboardDto,
  ) {
    return this.dashboardService.getOverview(req.user.id, query);
  }
}
