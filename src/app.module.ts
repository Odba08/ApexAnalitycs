import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { ScheduleModule } from '@nestjs/schedule';
import { AiEngineModule } from './ai-engine/ai-engine.module';
import { PrismaModule } from './prisma/prisma.module';
import { SportsApiModule } from './sports-api/sports-api.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import * as dotenv from 'dotenv';

dotenv.config();

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TelegrafModule.forRoot({
      token: process.env.TELEGRAM_BOT_TOKEN!,
    }),
    PrismaModule,
    AiEngineModule,
    SportsApiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
