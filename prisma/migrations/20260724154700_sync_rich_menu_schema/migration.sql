-- AlterTable
ALTER TABLE "rich_menus" ADD COLUMN     "areas" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "chatBarText" TEXT NOT NULL DEFAULT 'Menu',
ADD COLUMN     "lineRichMenuId" TEXT,
ADD COLUMN     "menuType" TEXT NOT NULL DEFAULT 'default',
ADD COLUMN     "selected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sizeHeight" INTEGER NOT NULL DEFAULT 1686,
ADD COLUMN     "sizeWidth" INTEGER NOT NULL DEFAULT 2500;

-- CreateIndex
CREATE UNIQUE INDEX "rich_menus_lineRichMenuId_key" ON "rich_menus"("lineRichMenuId");

-- CreateIndex
CREATE INDEX "rich_menus_lineAccountId_menuType_idx" ON "rich_menus"("lineAccountId", "menuType");
