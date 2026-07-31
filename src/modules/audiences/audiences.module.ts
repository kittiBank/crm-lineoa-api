import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { AudiencesController } from './audiences.controller';
import { AudiencesService } from './audiences.service';

@Module({
  imports: [PrismaModule],
  controllers: [AudiencesController],
  providers: [AudiencesService],
  exports: [AudiencesService],
})
export class AudiencesModule {}
