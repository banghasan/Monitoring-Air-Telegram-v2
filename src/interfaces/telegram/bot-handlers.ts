import type { Bot, Context } from "grammy";
import { fetchInternalMonitorStatus } from "../../app/bot/internal-status-client.js";
import type { AppConfig } from "../../config/config.js";
import { formatFetchedAt } from "../../domain/water/water-policy.js";
import type { WaterCache } from "../../infrastructure/cache/water-cache.js";
import type { StructuredLogger } from "../../infrastructure/logging/structured-logger.js";
import { retryLogger, withRetry } from "../../infrastructure/retry/retry.js";
import type { TelegramRichClient } from "../../infrastructure/telegram/telegram-client.js";
import {
  buildAirRichMessage,
  buildErrorRichMessage,
  buildHelpRichMessage,
  buildManualMonitorRichMessage,
  buildMonitorDispatchResultRichMessage,
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

type ManualNotificationCommand = "notify" | "notifyair";

interface ManualNotificationStatus {
  command: ManualNotificationCommand;
  at: string;
  sentCount: number;
  totalCount: number;
  failedTargets: string[];
}

export function installBotHandlers(options: BotHandlersOptions): void {
  const { bot, client, cache, config, logger } = options;
  const cooldowns = new Map<string, number>();
  let lastManualNotification: ManualNotificationStatus | undefined;

  bot.command("air", async (ctx) => {
    if (!allowCommand(ctx, cooldowns, config.publicCommandCooldownSeconds)) return;
    await sendAir(ctx, client, cache, config, logger);
  });

  bot.command("ping", async (ctx) => {
    if (!allowCommand(ctx, cooldowns, config.publicCommandCooldownSeconds)) return;
    await sendPing(ctx, client, logger);
  });

  const versionHandler = async (ctx: Context) => {
    if (!allowCommand(ctx, cooldowns, config.publicCommandCooldownSeconds)) return;
    await sendToContext(ctx, client, buildVersionRichMessage(config.app.version));
  };
  bot.command(["version", "ver", "versi"], versionHandler);

  const helpHandler = async (ctx: Context) => {
    if (!allowCommand(ctx, cooldowns, config.publicCommandCooldownSeconds)) return;
    await sendToContext(
      ctx,
      client,
      buildHelpRichMessage(config.water.sourceUrl, {
        includeAdminCommands: isOwnerOrAdmin(ctx, config),
      }),
    );
  };
  bot.command("start", helpHandler);
  bot.command("help", helpHandler);

  bot.command("notify", async (ctx) => {
    if (!isOwnerOrAdmin(ctx, config)) return;
    const text = ctx.match.trim();
    if (!text) {
      await sendToContext(
        ctx,
        client,
        buildErrorRichMessage(
          "Format command",
          "Gunakan /notify <pesan> untuk mengirim test atau informasi ke grup monitor.",
        ),
      );
      return;
    }
    lastManualNotification =
      (await sendManualMonitorMessage(ctx, text, client, config, logger)) ?? lastManualNotification;
  });

  bot.command("notifyair", async (ctx) => {
    if (!isOwnerOrAdmin(ctx, config)) return;
    lastManualNotification =
      (await sendAirToMonitor(ctx, client, cache, config, logger)) ?? lastManualNotification;
  });

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
    if (lastManualNotification) {
      const command = `/${lastManualNotification.command}`;
      lines.push(
        `📤 ${command} terakhir: ${lastManualNotification.sentCount}/${lastManualNotification.totalCount} target`,
      );
      lines.push(
        `🕒 Waktu ${command} terakhir: ${formatFetchedAt(lastManualNotification.at, config.app.timezone)}`,
      );
      if (lastManualNotification.failedTargets.length > 0) {
        lines.push(`❌ ${command} gagal: ${lastManualNotification.failedTargets.join(", ")}`);
      }
    } else {
      lines.push("📤 /notify atau /notifyair terakhir: belum pernah dijalankan");
    }
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

async function sendPing(
  ctx: Context,
  client: TelegramRichClient,
  logger: StructuredLogger,
): Promise<void> {
  if (!ctx.chat) return;

  const placeholder = buildPingRichMessage();
  const started = performance.now();
  let sentMessage: Awaited<ReturnType<TelegramRichClient["sendToChat"]>>;
  try {
    sentMessage = await client.sendToChat(ctx.chat.id, placeholder, ctx.message?.message_thread_id);
  } catch (error) {
    logger.error("telegram.ping.error", "ping message could not be sent", error);
    return;
  }

  const responseMilliseconds = performance.now() - started;
  try {
    await client.edit(
      { chatId: sentMessage.chat.id, messageId: sentMessage.message_id },
      buildPingRichMessage(responseMilliseconds),
    );
    logger.debug("telegram.ping.response", "telegram response time measured", {
      response_ms: Number(responseMilliseconds.toFixed(2)),
      response_seconds: Number((responseMilliseconds / 1000).toFixed(4)),
    });
  } catch (error) {
    logger.warn("telegram.ping.edit_failed", "ping response time could not be displayed", {
      error_message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function sendManualMonitorMessage(
  ctx: Context,
  text: string,
  client: TelegramRichClient,
  config: AppConfig,
  logger: StructuredLogger,
): Promise<ManualNotificationStatus | undefined> {
  if (config.monitor.targets.length === 0) {
    await sendNoMonitorTargetError(ctx, client, logger, "telegram.manual_notification.no_target");
    return undefined;
  }

  const message = buildManualMonitorRichMessage(text, senderLabel(ctx), config.app.timezone);
  const dispatch = await dispatchToMonitorTargets(
    message,
    client,
    config,
    logger,
    "manual monitor notification",
  );

  await sendToContext(
    ctx,
    client,
    buildMonitorDispatchResultRichMessage(
      dispatch.sentCount,
      dispatch.totalCount,
      dispatch.failedTargets,
    ),
  );
  return {
    command: "notify",
    at: new Date().toISOString(),
    ...dispatch,
  };
}

async function sendAirToMonitor(
  ctx: Context,
  client: TelegramRichClient,
  cache: WaterCache,
  config: AppConfig,
  logger: StructuredLogger,
): Promise<ManualNotificationStatus | undefined> {
  if (config.monitor.targets.length === 0) {
    await sendNoMonitorTargetError(ctx, client, logger, "telegram.manual_air.no_target");
    return undefined;
  }

  let result: Awaited<ReturnType<WaterCache["get"]>>;
  try {
    result = await cache.get();
  } catch (error) {
    logger.error("telegram.manual_air.error", "manual air message could not be prepared", error);
    await sendToContext(
      ctx,
      client,
      buildErrorRichMessage("Data belum tersedia", "Sumber data sedang tidak dapat diakses."),
    );
    return undefined;
  }

  if (result.kind === "stale") {
    logger.warn("cache.stale_served", "stale water cache served", {
      last_error: result.lastError,
      trigger: "notifyair",
    });
  }

  const dispatch = await dispatchToMonitorTargets(
    buildAirRichMessage(result.reading, config.app.timezone, result),
    client,
    config,
    logger,
    "manual air notification",
  );
  await sendToContext(
    ctx,
    client,
    buildMonitorDispatchResultRichMessage(
      dispatch.sentCount,
      dispatch.totalCount,
      dispatch.failedTargets,
    ),
  );
  return {
    command: "notifyair",
    at: new Date().toISOString(),
    ...dispatch,
  };
}

interface MonitorDispatchResult {
  sentCount: number;
  totalCount: number;
  failedTargets: string[];
}

async function dispatchToMonitorTargets(
  message: Parameters<TelegramRichClient["send"]>[1],
  client: TelegramRichClient,
  config: AppConfig,
  logger: StructuredLogger,
  operationName: string,
): Promise<MonitorDispatchResult> {
  let sentCount = 0;
  const failedTargets: string[] = [];
  for (const target of config.monitor.targets) {
    try {
      await withRetry(() => client.send(target, message), {
        operation: `${operationName} ${target.label}`,
        maxAttempts: config.monitor.telegramSendMaxAttempts,
        backoffSeconds: config.monitor.telegramSendRetryBackoffSeconds,
        onRetry: retryLogger(logger, `${operationName} ${target.label}`),
      });
      sentCount += 1;
      logger.info("telegram.manual_dispatch.success", "manual monitor message sent", {
        operation: operationName,
        target: target.label,
        thread_id: target.threadId,
      });
    } catch (error) {
      failedTargets.push(target.label);
      logger.error("telegram.manual_dispatch.error", "manual monitor message failed", error, {
        operation: operationName,
        target: target.label,
        thread_id: target.threadId,
      });
    }
  }
  return { sentCount, totalCount: config.monitor.targets.length, failedTargets };
}

async function sendNoMonitorTargetError(
  ctx: Context,
  client: TelegramRichClient,
  logger: StructuredLogger,
  event: string,
): Promise<void> {
  logger.warn(event, "manual monitor message has no target");
  await sendToContext(
    ctx,
    client,
    buildErrorRichMessage(
      "Target monitor belum dikonfigurasi",
      "Isi MONITOR_TARGETS_JSON terlebih dahulu, lalu cek /system.",
    ),
  );
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

function senderLabel(ctx: Context): string {
  const user = ctx.from;
  if (!user) return "owner/admin";
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
  if (user.username) return `${name || "Telegram user"} (@${user.username})`;
  return name || `ID ${user.id}`;
}
