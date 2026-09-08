export const AUDIENCE_COUNT_CACHE_TTL_SECONDS = 5 * 60;

export function allFollowersCacheKey(lineAccountId: string): string {
  return `audience:all-followers:${lineAccountId}`;
}

export function audienceDbCountCacheKey(
  lineAccountId: string,
  type: 'active' | 'new' | 'user_type',
  suffix: string,
): string {
  return `audience:count:${type}:${lineAccountId}:${suffix}`;
}
