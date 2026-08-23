-- AlterTable
ALTER TABLE "line_accounts" ADD COLUMN "quotaRemaining" INTEGER;
ALTER TABLE "line_accounts" ADD COLUMN "quotaSyncedAt" TIMESTAMP(3);
