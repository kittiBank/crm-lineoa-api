-- AlterTable
ALTER TABLE "message_templates"
ADD COLUMN IF NOT EXISTS "description" TEXT,
ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'Other',
ADD COLUMN IF NOT EXISTS "messages" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "usageCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "message_templates"
ALTER COLUMN "content" SET DEFAULT '[]';

UPDATE "message_templates"
SET "messages" = CASE
  WHEN "content" IS NOT NULL AND "content" <> '' THEN "content"::jsonb
  ELSE '[]'::jsonb
END
WHERE "messages" = '[]'::jsonb;

CREATE INDEX IF NOT EXISTS "message_templates_userId_category_idx" ON "message_templates"("userId", "category");
CREATE INDEX IF NOT EXISTS "message_templates_userId_isActive_idx" ON "message_templates"("userId", "isActive");
