import { expect, test } from "bun:test";
import type { Bot } from "grammy";
import { TelegramRichClient } from "../../src/infrastructure/telegram/telegram-client.js";

test("Telegram client meneruskan thread_id pada sendRichMessage dan mengedit Rich Message", async () => {
  const calls: unknown[][] = [];
  const fakeBot = {
    api: {
      sendRichMessage: async (...args: unknown[]) => {
        calls.push(args);
      },
      editMessageText: async (...args: unknown[]) => {
        calls.push(args);
      },
      answerCallbackQuery: async () => undefined,
    },
  } as unknown as Bot;
  const client = new TelegramRichClient("test-token", { bot: fakeBot });
  const message = { blocks: [{ type: "paragraph" as const, text: "test" }] };
  await client.send({ chatId: -100123, threadId: 42, label: "test" }, message);
  await client.send({ chatId: -100456, label: "channel" }, message);
  await client.edit({ chatId: -100123, messageId: 7 }, message);
  expect(calls[0]).toEqual([-100123, message, { message_thread_id: 42 }]);
  expect(calls[1]).toEqual([-100456, message, {}]);
  expect(calls[2]).toEqual([-100123, 7, message]);
});
