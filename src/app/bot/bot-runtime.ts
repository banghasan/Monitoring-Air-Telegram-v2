import type { Update } from "@grammyjs/types";
import { Bot } from "grammy";
import type { AppConfig } from "../../config/config.js";
import { WaterCache } from "../../infrastructure/cache/water-cache.js";
import type { StructuredLogger } from "../../infrastructure/logging/structured-logger.js";
import { XmlWaterSource } from "../../infrastructure/source/xml-water-source.js";
import { TelegramRichClient } from "../../infrastructure/telegram/telegram-client.js";
import { createBotHttpServer } from "../../interfaces/http/runtime-server.js";
import { installBotHandlers } from "../../interfaces/telegram/bot-handlers.js";

export async function startBot(config: AppConfig, logger: StructuredLogger): Promise<void> {
  const bot = new Bot(config.telegram.token);
  const client = new TelegramRichClient(config.telegram.token, { bot });
  const source = new XmlWaterSource({
    sourceUrl: config.water.sourceUrl,
    stationQuery: config.water.stationQuery,
    stationDisplayName: config.water.stationDisplayName,
    timeoutSeconds: config.water.upstreamTimeoutSeconds,
  });
  const cache = new WaterCache(source, {
    ttlSeconds: config.water.cacheTtlSeconds,
    staleIfErrorSeconds: config.water.staleIfErrorSeconds,
    maxDataAgeSeconds: config.water.maxDataAgeSeconds,
  });
  installBotHandlers({ config, bot, client, cache, logger });
  const cacheInterval = setInterval(() => {
    void cache
      .get(true)
      .catch((error) =>
        logger.error("cache.refresh.error", "background cache refresh failed", error),
      );
  }, config.water.cacheRefreshSeconds * 1000);
  void cache
    .get()
    .catch((error) =>
      logger.error("cache.initial_refresh.error", "initial cache refresh failed", error),
    );

  const webhookHandler = async (
    request: Request,
    secret: string | undefined,
  ): Promise<Response> => {
    if (config.telegram.mode !== "webhook" || secret !== config.telegram.webhookSecret) {
      return new Response("unauthorized", { status: 401 });
    }
    try {
      await bot.handleUpdate((await request.json()) as Update);
      return new Response("ok", { status: 200 });
    } catch (error) {
      logger.error("telegram.webhook.error", "webhook update failed", error);
      return new Response("failed", { status: 500 });
    }
  };

  const app = createBotHttpServer(config, webhookHandler, logger);
  app.listen({ hostname: "0.0.0.0", port: config.app.port });
  logger.info("app.start", "bot http server started", {
    port: config.app.port,
    mode: config.telegram.mode,
  });

  const shutdown = (): void => {
    clearInterval(cacheInterval);
    bot.stop();
    app
      .stop()
      .catch((error) => logger.error("app.shutdown.error", "bot http shutdown failed", error));
    logger.info("app.shutdown", "bot shutdown requested");
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);

  if (config.telegram.mode === "polling") {
    await bot.api.deleteWebhook();
    await bot.start({
      onStart: (botInfo) =>
        logger.info("telegram.polling.started", "telegram polling started", {
          username: botInfo.username,
        }),
    });
  } else if (config.telegram.webhookUrl) {
    await bot.api.setWebhook(config.telegram.webhookUrl, {
      secret_token: config.telegram.webhookSecret,
    });
    logger.info("telegram.webhook.started", "telegram webhook configured", {
      url: config.telegram.webhookUrl,
    });
  }
}
