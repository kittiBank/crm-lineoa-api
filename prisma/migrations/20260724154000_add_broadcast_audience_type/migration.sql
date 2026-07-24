-- AlterTable
ALTER TABLE "broadcasts" ADD COLUMN IF NOT EXISTS "audienceType" TEXT NOT NULL DEFAULT 'all';
