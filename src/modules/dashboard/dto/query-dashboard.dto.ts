import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional } from 'class-validator';

export const DASHBOARD_PERIODS = ['today', '7d', 'month'] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

/** @deprecated Use `period` instead. Kept so older clients still work. */
export const DASHBOARD_TREND_DAYS = [7, 30, 90] as const;
export type DashboardTrendDays = (typeof DASHBOARD_TREND_DAYS)[number];

export class QueryDashboardDto {
  @ApiPropertyOptional({
    enum: DASHBOARD_PERIODS,
    default: 'today',
    description:
      'Dashboard time range: today, last 7 days, or the current calendar month (Asia/Bangkok)',
  })
  @IsOptional()
  @IsIn(DASHBOARD_PERIODS)
  period?: DashboardPeriod = 'today';

  @ApiPropertyOptional({
    enum: DASHBOARD_TREND_DAYS,
    deprecated: true,
    description: 'Deprecated. Use period instead.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn(DASHBOARD_TREND_DAYS)
  days?: DashboardTrendDays;
}
