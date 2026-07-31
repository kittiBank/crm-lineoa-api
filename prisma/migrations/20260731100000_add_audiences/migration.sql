-- CreateTable
CREATE TABLE "audiences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "criteria" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audiences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audiences_userId_idx" ON "audiences"("userId");

-- CreateIndex
CREATE INDEX "audiences_userId_isActive_idx" ON "audiences"("userId", "isActive");

-- AddForeignKey
ALTER TABLE "audiences" ADD CONSTRAINT "audiences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
