import type { Bot, Context } from "grammy";
import { fetchInternalMonitorStatus } from "../../app/bot/internal-status-client.js";
import type { AppConfig } from "../../config/config.js";
import type { WaterCache } from "../../infrastructure/cache/water-cache.js";
import type { StructuredLogger } from "../../infrastructure/logging/structured-logger.js";
import type { TelegramRichClient } from "../../infrastructure/telegram/telegram-client.js";
import {
  buildAirRichMessage,
  buildErrorRichMessage,
  buildHelpRichMessage,
  buildPingRichMessage,
  buildSystemRichMessage,
  buildVersionRichMessage,
  REFRESH_CALLBACK,
} from "./rich-message-builder.js";

export interface BotHandlersOptions {
  config: AppConfig;
  bot: Bot;
  client: TelegramRichClient;
  cache: WaterCache;
  logger: StructuredLogger;
}

export function installBotHandlers(options: BotHandlersOptions): void {
  const { bot, client, cache, config, logger } = options;
  const cooldowns = new Map<string, number>();

  bot.command("air", async (ctx) => {
    if (!allowCommand(ctx, cooldowns, config.publicCommandCooldownSeconds)) return;
    await sendAir(ctx, client, cache, config, logger);
  });

  bot.command("ping", async (ctx) => {
    if (!allowCommand(ctx, cooldowns, config.publicCommandCooldownSeconds)) return;
    const started = performance.now();
    const message = buildPingRichMessage(performance.now() - started);
    await sendToContext(ctx, client, message);
  });

  const versionHandler = async (ctx: Context) => {
    if (!allowCommand(ctx, cooldowns, config.publicCommandCooldownSeconds)) return;
    await sendToContext(ctx, client, buildVersionRichMessage(config.app.version));
  };
  bot.command(["version", "ver", "versi"], versionHandler);

  const helpHandler = async (ctx: Context) => {
    if (!allowCommand(ctx, cooldowns, config.publicCommandCooldownSeconds)) return;
    await sendToContext(ctx, client, buildHelpRichMessage(config.water.sourceUrl));
  };
  bot.command("start", helpHandler);
  bot.command("help", helpHandler);

  bot.command("system", async (ctx) => {
    if (!isOwnerOrAdmin(ctx, config)) return;
    const cacheSnapshot = cache.getSnapshot();
    const monitor = await fetchInternalMonitorStatus(config);
    const uptimeSeconds = Math.floor(process.uptime());
    const lines = [
      `🧩 Versi aplikasi: ${config.app.version}`,
      `🛠️ Role: ${config.app.role}`,
      `📡 Mode Telegram: ${config.telegram.mode}`,
      `⏱️ Uptime: ${uptimeSeconds} detik`,
      `💾 Cache: ${cacheSnapshot ? (Date.now() < cacheSnapshot.expiresAt ? "fresh" : "stale/expired") : "kosong"}`,
      `📏 Batas usia sumber: ${config.water.maxDataAgeSeconds} detik`,
      `🔎 Selector: mengandung “${config.water.stationQuery}”`,
      `🌐 Sumber: ${config.water.sourceUrl}`,
      `📣 Monitor endpoint: ${monitor.status}`,
      `🎯 Target lokal: ${config.monitor.targets.length}`,
    ];
    if (cacheSnapshot?.lastError) lines.push(`⚠️ Error cache terakhir: ${cacheSnapshot.lastError}`);
    if (monitor.monitor) {
      lines.push(`📊 Worker: ${monitor.monitor.lastError ? "error" : "aktif"}`);
      lines.push(`🚦 Status terakhir: ${monitor.monitor.lastStatus ?? "baseline belum tersedia"}`);
      lines.push(`🔁 Interval: ${monitor.monitor.intervalSeconds} detik`);
      lines.push(`📬 Pending delivery: ${monitor.monitor.pendingDeliveries}`);
      lines.push(`❌ Delivery gagal: ${monitor.monitor.failedDeliveries}`);
    }
    if (monitor.error) lines.push(`⚠️ Detail internal: ${monitor.error}`);
    await sendToContext(ctx, client, buildSystemRichMessage(lines));
  });

  bot.on("callback_query:data", async (ctx) => {
    if (ctx.callbackQuery.data !== REFRESH_CALLBACK) return;
    await ctx.answerCallbackQuery({ text: "Memperbarui data…" });
    const callbackMessage = ctx.callbackQuery.message;
    if (!callbackMessage || !("chat" in callbackMessage)) return;
    try {
      const result = await cache.get(true);
      const richMessage = buildAirRichMessage(result.reading, config.app.timezone, result);
      try {
        await client.edit(
          { chatId: callbackMessage.chat.id, messageId: callbackMessage.message_id },
          richMessage,
        );
        logger.info("telegram.rich_message.edit_success", "air message edited", {
          cache_kind: result.kind,
        });
      } catch (error) {
        logger.warn(
          "telegram.rich_message.edit_fallback",
          "edit failed; sending a new rich message",
          {
            error_message: error instanceof Error ? error.message : String(error),
          },
        );
        await client.sendToChat(
          callbackMessage.chat.id,
          richMessage,
          callbackMessage.message_thread_id,
        );
      }
    } catch (error) {
      logger.error("telegram.air.error", "refresh failed", error);
      await client.sendToChat(
        callbackMessage.chat.id,
        buildErrorRichMessage("Data belum tersedia", "Sumber data sedang tidak dapat diakses."),
        callbackMessage.message_thread_id,
      );
    }
  });
}

async function sendAir(
  ctx: Context,
  client: TelegramRichClient,
  cache: WaterCache,
  config: AppConfig,
  logger: StructuredLogger,
): Promise<void> {
  try {
    const result = await cache.get();
    await sendToContext(
      ctx,
      client,
      buildAirRichMessage(result.reading, config.app.timezone, result),
    );
    if (result.kind === "stale") {
      logger.warn("cache.stale_served", "stale water cache served", {
        last_error: result.lastError,
      });
    }
  } catch (error) {
    logger.error("telegram.air.error", "air command failed", error);
    await sendToContext(
      ctx,
      client,
      buildErrorRichMessage("Data belum tersedia", "Sumber data sedang tidak dapat diakses."),
    );
  }
}

async function sendToContext(
  ctx: Context,
  client: TelegramRichClient,
  message: Parameters<TelegramRichClient["sendToChat"]>[1],
): Promise<void> {
  if (!ctx.chat) return;
  await client.sendToChat(ctx.chat.id, message, ctx.message?.message_thread_id);
}

function allowCommand(
  ctx: Context,
  cooldowns: Map<string, number>,
  cooldownSeconds: number,
): boolean {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  if (chatId === undefined || userId === undefined) return false;
  const key = `${chatId}:${userId}`;
  const now = Date.now();
  const last = cooldowns.get(key) ?? 0;
  if (now - last < cooldownSeconds * 1000) return false;
  cooldowns.set(key, now);
  return true;
}

function isOwnerOrAdmin(ctx: Context, config: AppConfig): boolean {
  const userId = ctx.from?.id;
  if (userId === undefined) return false;
  return userId === config.telegram.ownerId || config.telegram.adminIds.includes(userId);
}
