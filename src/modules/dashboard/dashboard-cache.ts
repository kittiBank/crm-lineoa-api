import { DASHBOARD_PERIODS, DashboardPeriod } from './dto/query-dashboard.dto';

export const DASHBOARD_CACHE_TTL_SECONDS = 5 * 60;

export function dashboardOverviewCacheKey(
  userId: string,
  period: DashboardPeriod,
): string {
  return `dashboard:overview:${userId}:${period}`;
}

export function dashboardOverviewCacheKeys(userId: string): string[] {
  return DASHBOARD_PERIODS.map((period) =>
    dashboardOverviewCacheKey(userId, period),
  );
}
