import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AiEngineService } from './ai-engine.service';
import { ApuestasCronService } from './cron.service';
import { F1Service } from './f1.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SportsApiModule } from '../sports-api/sports-api.module';

@Module({
  imports: [
    HttpModule,
    PrismaModule,
    SportsApiModule,
  ],
  providers: [AiEngineService, ApuestasCronService, F1Service],
  exports: [AiEngineService, F1Service],
})
export class AiEngineModule {}
