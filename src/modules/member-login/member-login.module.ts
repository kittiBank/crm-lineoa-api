import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { MemberLoginController } from './member-login.controller';
import { MemberLoginService } from './member-login.service';

@Module({
  imports: [PrismaModule],
  controllers: [MemberLoginController],
  providers: [MemberLoginService],
  exports: [MemberLoginService],
})
export class MemberLoginModule {}
