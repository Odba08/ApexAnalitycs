import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios'; // <-- Agregamos esta importación
import { AiEngineService } from './ai-engine.service';
import { ApuestasCronService } from './cron.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SportsApiModule } from '../sports-api/sports-api.module';

@Module({
  imports: [
    HttpModule, // <-- Lo metemos aquí para que AiEngineService pueda hablar con Python
    PrismaModule,
    SportsApiModule,
  ],
  providers: [AiEngineService, ApuestasCronService],
})
export class AiEngineModule {}
