import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SportsApiService } from './sports-api.service';

@Module({
  imports: [HttpModule], // Agregamos esto
  providers: [SportsApiService],
  exports: [SportsApiService], // Lo exportamos para usarlo en el Cronjob
})
export class SportsApiModule {}
