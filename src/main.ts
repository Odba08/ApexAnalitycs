import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';

// Esto inyecta el .env en toda la aplicación antes de que arranque Prisma
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Si tu puerto original era otro, mantenlo aquí (usualmente es 3000)
  await app.listen(3000);
}
bootstrap();
