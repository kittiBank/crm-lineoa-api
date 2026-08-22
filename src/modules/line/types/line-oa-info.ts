export type LineOaInfo = {
  botUserId: string;
  basicId: string;
  premiumId: string | null;
  displayName: string;
  pictureUrl: string | null;
  chatMode: string | null;
  markAsReadMode: string | null;
  followerCount: number | null;
  targetedReaches: number | null;
  blockCount: number | null;
  quotaType: string | null;
  quotaLimit: number | null;
  quotaUsed: number | null;
  infoSyncedAt: string;
};

export type LineOaInfoFields = Omit<LineOaInfo, 'infoSyncedAt'> & {
  infoSyncedAt: Date;
};

export type StoredLineOaInfo = {
  id?: string;
  userId?: string;
  name?: string;
  channelSecret?: string;
  channelAccessToken?: string;
  createdAt?: Date;
  updatedAt?: Date;
  botUserId?: string | null;
  basicId?: string | null;
  premiumId?: string | null;
  displayName?: string | null;
  pictureUrl?: string | null;
  chatMode?: string | null;
  markAsReadMode?: string | null;
  followerCount?: number | null;
  targetedReaches?: number | null;
  blockCount?: number | null;
  quotaType?: string | null;
  quotaLimit?: number | null;
  quotaUsed?: number | null;
  infoSyncedAt?: Date | null;
};
