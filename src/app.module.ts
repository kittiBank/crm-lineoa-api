import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { LineModule } from './modules/line/line.module';
import { MessagesModule } from './modules/messages/messages.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { StorageModule } from './modules/storage/storage.module';
import { RichMenuModule } from './modules/rich-menu/rich-menu.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { winstonConfig } from './config/winston.config';
import { HttpLoggerMiddleware } from './common/middleware/http-logger.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    WinstonModule.forRoot(winstonConfig),
    PrismaModule,
    AuthModule,
    UsersModule,
    LineModule,
    MessagesModule,
    CampaignsModule,
    StorageModule,
    RichMenuModule,
    TemplatesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpLoggerMiddleware).forRoutes('*');
  }
}
