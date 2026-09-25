import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AiEngineService } from './ai-engine.service';
import { ApuestasCronService } from './cron.service';
import { F1Service } from './f1.service';
import { UfcService } from './ufc.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SportsApiModule } from '../sports-api/sports-api.module';

@Module({
  imports: [
    HttpModule,
    PrismaModule,
    SportsApiModule,
  ],
  providers: [AiEngineService, ApuestasCronService, F1Service, UfcService],
  exports: [AiEngineService, F1Service, UfcService],
})
export class AiEngineModule {}
