-- AlterTable
ALTER TABLE "line_users" ADD COLUMN "userTier" TEXT;

-- CreateIndex
CREATE INDEX "line_users_lineAccountId_userTier_idx" ON "line_users"("lineAccountId", "userTier");
