import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { ScheduleModule } from '@nestjs/schedule'; // <-- Importación agregada
import { AiEngineModule } from './ai-engine/ai-engine.module';
import { PrismaModule } from './prisma/prisma.module';
import { SportsApiModule } from './sports-api/sports-api.module';
import * as dotenv from 'dotenv';

dotenv.config();

@Module({
  imports: [
    // Encendemos el motor de Cronjobs
    ScheduleModule.forRoot(),

    TelegrafModule.forRoot({
      token: process.env.TELEGRAM_BOT_TOKEN!,
    }),
    PrismaModule,
    AiEngineModule,
    SportsApiModule,
  ],
})
export class AppModule {}
