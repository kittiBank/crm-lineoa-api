import { Module } from '@nestjs/common';
import { LineService } from './line.service';
import { LineController } from './line.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { LineAccountRepository } from './repositories/line-account.repository';

@Module({
  imports: [PrismaModule],
  providers: [LineService, LineAccountRepository],
  controllers: [LineController],
  exports: [LineService],
})
export class LineModule {}
