import { expect, test } from "bun:test";
import type { Update } from "@grammyjs/types";
import { Bot } from "grammy";
import { parseConfig } from "../../src/config/config.js";
import { StructuredLogger } from "../../src/infrastructure/logging/structured-logger.js";
import type { TelegramRichClient } from "../../src/infrastructure/telegram/telegram-client.js";
import { installBotHandlers } from "../../src/interfaces/telegram/bot-handlers.js";

test("/ping mengirim placeholder lalu mengeditnya dengan waktu respons Telegram", async () => {
  const bot = new Bot("test-token", {
    botInfo: {
      id: 123,
      is_bot: true,
      first_name: "Test",
      username: "test_bot",
      can_join_groups: true,
      can_read_all_group_messages: true,
      supports_inline_queries: false,
      can_connect_to_business: false,
      has_main_web_app: false,
      has_topics_enabled: false,
      allows_users_to_create_topics: false,
      can_manage_bots: false,
      supports_join_request_queries: false,
    },
  });
  const calls: Array<{ method: "send" | "edit"; message: unknown }> = [];
  const client = {
    sendToChat: async (_chatId: number, message: unknown, _threadId?: number) => {
      calls.push({ method: "send", message });
      return {
        message_id: 99,
        chat: { id: -100123, type: "supergroup" },
        date: 1,
        rich_message: message,
      };
    },
    edit: async (_location: unknown, message: unknown) => {
      calls.push({ method: "edit", message });
    },
  } as unknown as TelegramRichClient;
  const config = parseConfig({
    TELEGRAM_BOT_TOKEN: "test-token",
    APP_ROLE: "bot",
    PUBLIC_COMMAND_COOLDOWN_SECONDS: "1",
  });
  const logger = new StructuredLogger("test", () => undefined);
  installBotHandlers({
    config,
    bot,
    client,
    cache: {} as never,
    logger,
  });

  await bot.handleUpdate({
    update_id: 1,
    message: {
      message_id: 1,
      date: 1,
      chat: { id: -100123, type: "supergroup" },
      from: { id: 77, is_bot: false, first_name: "Test" },
      text: "/ping",
      entities: [{ type: "bot_command", offset: 0, length: 5 }],
    },
  } as unknown as Update);

  expect(calls).toHaveLength(2);
  expect(calls[0]?.method).toBe("send");
  expect(JSON.stringify(calls[0]?.message)).toContain('"type":"code","text":"mengukur…"');
  expect(calls[1]?.method).toBe("edit");
  expect(JSON.stringify(calls[1]?.message)).toContain("Waktu respons:");
  expect(JSON.stringify(calls[1]?.message)).not.toContain("mengukur…");
  expect(JSON.stringify(calls[1]?.message)).not.toContain("Waktu proses bot");
});

test("/notify hanya owner/admin yang dapat mengirim pesan ke target monitor", async () => {
  const bot = new Bot("test-token", {
    botInfo: {
      id: 123,
      is_bot: true,
      first_name: "Test",
      username: "test_bot",
      can_join_groups: true,
      can_read_all_group_messages: true,
      supports_inline_queries: false,
      can_connect_to_business: false,
      has_main_web_app: false,
      has_topics_enabled: false,
      allows_users_to_create_topics: false,
      can_manage_bots: false,
      supports_join_request_queries: false,
    },
  });
  const monitorMessages: unknown[] = [];
  const replies: unknown[] = [];
  const client = {
    send: async (_target: unknown, message: unknown) => {
      monitorMessages.push(message);
    },
    sendToChat: async (_chatId: number, message: unknown) => {
      replies.push(message);
      return {
        message_id: 100,
        chat: { id: -100123, type: "supergroup" },
        date: 1,
        rich_message: message,
      };
    },
  } as unknown as TelegramRichClient;
  const config = parseConfig({
    TELEGRAM_BOT_TOKEN: "test-token",
    APP_ROLE: "bot",
    TELEGRAM_OWNER_ID: "77",
    TELEGRAM_ADMIN_IDS: "88",
    MONITOR_TARGETS_JSON: '[{"chat_id":"-100123","thread_id":42,"label":"Operasional"}]',
  });
  const logger = new StructuredLogger("test", () => undefined);
  installBotHandlers({
    config,
    bot,
    client,
    cache: { getSnapshot: () => undefined } as never,
    logger,
  });

  const update = (userId: number, updateId: number, text: string): Update =>
    ({
      update_id: updateId,
      message: {
        message_id: updateId,
        date: 1,
        chat: { id: -100999, type: "supergroup" },
        from: { id: userId, is_bot: false, first_name: "Test" },
        text,
        entities: [{ type: "bot_command", offset: 0, length: 7 }],
      },
    }) as unknown as Update;

  await bot.handleUpdate(update(77, 1, "/notify Uji notifikasi monitor"));
  await bot.handleUpdate(update(88, 2, "/notify Uji notifikasi admin"));
  await bot.handleUpdate(update(99, 3, "/notify Uji tanpa akses"));
  await bot.handleUpdate(update(77, 4, "/system"));

  expect(monitorMessages).toHaveLength(2);
  expect(JSON.stringify(monitorMessages[0])).toContain("Uji notifikasi monitor");
  expect(JSON.stringify(monitorMessages[1])).toContain("Uji notifikasi admin");
  expect(JSON.stringify(replies[0])).toContain("✅ TERKIRIM KE MONITOR");
  expect(JSON.stringify(replies[1])).toContain("✅ TERKIRIM KE MONITOR");
  expect(JSON.stringify(replies[2])).toContain("📤 /notify terakhir: 1/1 target");
  expect(replies).toHaveLength(3);
});

test("/notifyair mengirim snapshot /air ke monitor dan help admin bersifat kondisional", async () => {
  const bot = new Bot("test-token", {
    botInfo: {
      id: 123,
      is_bot: true,
      first_name: "Test",
      username: "test_bot",
      can_join_groups: true,
      can_read_all_group_messages: true,
      supports_inline_queries: false,
      can_connect_to_business: false,
      has_main_web_app: false,
      has_topics_enabled: false,
      allows_users_to_create_topics: false,
      can_manage_bots: false,
      supports_join_request_queries: false,
    },
  });
  const monitorMessages: unknown[] = [];
  const replies: unknown[] = [];
  const client = {
    send: async (target: unknown, message: unknown) => {
      monitorMessages.push({ target, message });
    },
    sendToChat: async (_chatId: number, message: unknown) => {
      replies.push(message);
      return {
        message_id: 100,
        chat: { id: -100123, type: "supergroup" },
        date: 1,
        rich_message: message,
      };
    },
  } as unknown as TelegramRichClient;
  const config = parseConfig({
    TELEGRAM_BOT_TOKEN: "test-token",
    APP_ROLE: "bot",
    TELEGRAM_OWNER_ID: "77",
    TELEGRAM_ADMIN_IDS: "88",
    MONITOR_TARGETS_JSON: '[{"chat_id":"-100123","thread_id":42,"label":"Operasional"}]',
  });
  const logger = new StructuredLogger("test", () => undefined);
  installBotHandlers({
    config,
    bot,
    client,
    cache: {
      get: async () => ({
        reading: {
          stationKey: "angke-hulu",
          stationName: "P.S. Angke Hulu 1",
          displayName: "P.S. Angke Hulu (Baru)",
          location: "Angke",
          latitude: -6.218026,
          longitude: 106.694077,
          observedAtRaw: "2026-09-17T15:10:00+07:00",
          observedAtIso: "2026-09-17T08:10:00.000Z",
          fetchedAt: "2026-09-17T08:10:00.000Z",
          heightRaw: -440,
          previousHeightRaw: -450,
          heightCm: -44,
          previousHeightCm: -45,
          statusRaw: "Status : Normal",
          statusNormalized: "NORMAL",
          thresholds: { siaga1Raw: 3000, siaga2Raw: 2500, siaga3Raw: 1500, siaga4Raw: 1 },
          sourceUrl: "https://poskobanjir.dsdadki.web.id/xmldata.xml",
          rawFields: {},
        },
        kind: "fresh",
        fetchedAt: "2026-09-17T08:10:00.000Z",
        sourceFresh: true,
      }),
      getSnapshot: () => undefined,
    } as never,
    logger,
  });

  const update = (userId: number, updateId: number, text: string): Update =>
    ({
      update_id: updateId,
      message: {
        message_id: updateId,
        date: 1,
        chat: { id: -100999, type: "supergroup" },
        from: { id: userId, is_bot: false, first_name: "Test" },
        text,
        entities: [{ type: "bot_command", offset: 0, length: text.split(" ")[0]?.length ?? 0 }],
      },
    }) as unknown as Update;

  await bot.handleUpdate(update(99, 1, "/help"));
  await bot.handleUpdate(update(77, 2, "/help"));
  await bot.handleUpdate(update(77, 3, "/notifyair"));
  await bot.handleUpdate(update(77, 4, "/system"));

  expect(JSON.stringify(replies[0])).not.toContain("/notifyair");
  expect(JSON.stringify(replies[1])).toContain("/notifyair");
  expect(monitorMessages).toHaveLength(1);
  expect(JSON.stringify(monitorMessages[0])).toContain("🌊 PEMANTAUAN TINGGI MUKA AIR (TMA)");
  expect(JSON.stringify(monitorMessages[0])).toContain("callback_data");
  expect(JSON.stringify(replies[2])).toContain("✅ TERKIRIM KE MONITOR");
  expect(JSON.stringify(replies[3])).toContain("📤 /notifyair terakhir: 1/1 target");
});
