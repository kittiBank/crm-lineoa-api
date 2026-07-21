import { Module } from '@nestjs/common';
import { RichMenuController } from './rich-menu.controller';
import { RichMenuService } from './rich-menu.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { LineAccountRepository } from '../line/repositories/line-account.repository';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [RichMenuController],
  providers: [RichMenuService, LineAccountRepository],
  exports: [RichMenuService],
})
export class RichMenuModule {}
