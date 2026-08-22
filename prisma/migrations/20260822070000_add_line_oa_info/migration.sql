-- AlterTable
ALTER TABLE "line_accounts" ADD COLUMN "botUserId" TEXT;
ALTER TABLE "line_accounts" ADD COLUMN "basicId" TEXT;
ALTER TABLE "line_accounts" ADD COLUMN "premiumId" TEXT;
ALTER TABLE "line_accounts" ADD COLUMN "displayName" TEXT;
ALTER TABLE "line_accounts" ADD COLUMN "pictureUrl" TEXT;
ALTER TABLE "line_accounts" ADD COLUMN "chatMode" TEXT;
ALTER TABLE "line_accounts" ADD COLUMN "markAsReadMode" TEXT;
ALTER TABLE "line_accounts" ADD COLUMN "followerCount" INTEGER;
ALTER TABLE "line_accounts" ADD COLUMN "targetedReaches" INTEGER;
ALTER TABLE "line_accounts" ADD COLUMN "blockCount" INTEGER;
ALTER TABLE "line_accounts" ADD COLUMN "quotaType" TEXT;
ALTER TABLE "line_accounts" ADD COLUMN "quotaLimit" INTEGER;
ALTER TABLE "line_accounts" ADD COLUMN "quotaUsed" INTEGER;
ALTER TABLE "line_accounts" ADD COLUMN "infoSyncedAt" TIMESTAMP(3);
