-- CreateTable
CREATE TABLE "auto_messages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "matchType" TEXT NOT NULL DEFAULT 'exact',
    "templateId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "triggerCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auto_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auto_messages_userId_idx" ON "auto_messages"("userId");

-- CreateIndex
CREATE INDEX "auto_messages_userId_isActive_idx" ON "auto_messages"("userId", "isActive");

-- CreateIndex
CREATE INDEX "auto_messages_userId_priority_idx" ON "auto_messages"("userId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "auto_messages_userId_keyword_key" ON "auto_messages"("userId", "keyword");

-- AddForeignKey
ALTER TABLE "auto_messages" ADD CONSTRAINT "auto_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_messages" ADD CONSTRAINT "auto_messages_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "message_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
