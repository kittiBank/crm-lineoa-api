import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { LineModule } from '../line/line.module';
import { AutoMessagesController } from './auto-messages.controller';
import { AutoMessagesService } from './auto-messages.service';
import { AutoReplyService } from './auto-reply.service';

@Module({
  imports: [PrismaModule, LineModule],
  controllers: [AutoMessagesController],
  providers: [AutoMessagesService, AutoReplyService],
  exports: [AutoMessagesService, AutoReplyService],
})
export class AutoMessagesModule {}
