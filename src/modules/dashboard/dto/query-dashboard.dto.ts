import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional } from 'class-validator';

export const DASHBOARD_TREND_DAYS = [7, 30, 90] as const;
export type DashboardTrendDays = (typeof DASHBOARD_TREND_DAYS)[number];

export class QueryDashboardDto {
  @ApiPropertyOptional({
    enum: DASHBOARD_TREND_DAYS,
    default: 7,
    description: 'Number of days for the broadcast trend chart',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn(DASHBOARD_TREND_DAYS)
  days?: DashboardTrendDays = 7;
}
