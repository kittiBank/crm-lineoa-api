export const TEMPLATES_LIST_CACHE_TTL_SECONDS = 5 * 60;

export function templatesListCacheKey(userId: string): string {
  return `templates:list:${userId}`;
}
