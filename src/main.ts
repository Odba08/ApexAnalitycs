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
  const expressApp = app.getHttpAdapter().getInstance();

  // Dedoop simple en memoria para evitar procesar dos veces el mismo update_id si Telegram reintenta tras cold-start
  const processedUpdates = new Set<number>();

  expressApp.post('/telegram-webhook', (req: any, res: any) => {
    // Responder 200 OK de inmediato a Telegram para que no acumule reintentos
    res.status(200).send({ ok: true });

    const update = req.body;
    if (update && typeof update.update_id === 'number') {
      if (processedUpdates.has(update.update_id)) {
        return;
      }
      processedUpdates.add(update.update_id);
      if (processedUpdates.size > 500) {
        const first = processedUpdates.values().next().value;
        if (first !== undefined) processedUpdates.delete(first);
      }

      bot.handleUpdate(update).catch((err: any) => {
        console.error('Error procesando update en /telegram-webhook:', err?.message || err);
      });
    }
  });

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
