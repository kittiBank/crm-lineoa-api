-- CreateEnum
CREATE TYPE "UserTier" AS ENUM ('Silver', 'Gold', 'Platinum');

-- AlterTable
ALTER TABLE "line_users"
ALTER COLUMN "userTier" TYPE "UserTier"
USING (
  CASE
    WHEN "userTier" IN ('Silver', 'Gold', 'Platinum') THEN "userTier"::"UserTier"
    ELSE NULL
  END
);
