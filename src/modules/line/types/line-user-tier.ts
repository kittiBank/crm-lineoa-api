export enum LineUserTier {
  Silver = 'Silver',
  Gold = 'Gold',
  Platinum = 'Platinum',
}

export const LINE_USER_TIERS = Object.values(LineUserTier);

export const LINE_USER_TIER_FILTERS = ['All', ...LINE_USER_TIERS] as const;

export type LineUserTierFilter = (typeof LINE_USER_TIER_FILTERS)[number];

export function isLineUserTier(value: unknown): value is LineUserTier {
  return (LINE_USER_TIERS as string[]).includes(value as string);
}

export function mapLineUserTier(
  value: string | null | undefined,
): LineUserTier | null {
  return isLineUserTier(value) ? value : null;
}
