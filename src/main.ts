import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getBotToken } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import * as dotenv from 'dotenv';

// Esto inyecta el .env en toda la aplicación antes de que arranque Prisma
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const bot = app.get<Telegraf>(getBotToken());

  const port = process.env.PORT || 3000;
  await app.listen(port);

  const webhookBaseUrl = (
    process.env.WEBHOOK_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    'https://apexanalitycs.onrender.com'
  ).replace(/\/$/, '');

  if (process.env.USE_LOCAL_POLLING === 'true') {
    await bot.telegram.deleteWebhook({ drop_pending_updates: false }).catch(() => {});
    bot.launch().catch((err) => console.error('Error en bot.launch local:', err));
  } else {
    const webhookUrl = `${webhookBaseUrl}/telegram-webhook`;
    await bot.telegram
      .setWebhook(webhookUrl, { drop_pending_updates: false })
      .then(() => console.log(`✅ Telegram Webhook activo en: ${webhookUrl}`))
      .catch((err) => console.error('Error registrando Telegram Webhook:', err?.message || err));
  }
}
bootstrap();
