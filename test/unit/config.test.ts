import { expect, test } from "bun:test";
import { ConfigurationError, parseConfig } from "../../src/config/config.js";

const base = {
  TELEGRAM_BOT_TOKEN: "test-token",
  APP_ROLE: "monitor",
  MONITOR_TARGETS_JSON: '[{"chat_id":"-100123","thread_id":42,"label":"Test"}]',
  INTERNAL_STATUS_URL: "http://monitor:3000/internal/status",
  INTERNAL_STATUS_TOKEN: "secret",
};

test("config memetakan target group forum dan default interval", () => {
  const config = parseConfig(base);
  expect(config.monitor.intervalSeconds).toBe(60);
  expect(config.monitor.targets[0]?.chatId).toBe(-100123);
  expect(config.monitor.targets[0]?.threadId).toBe(42);
});

test("config menolak monitor production tanpa tepat satu target", () => {
  expect(() => parseConfig({ TELEGRAM_BOT_TOKEN: "test-token", APP_ROLE: "monitor" })).toThrow(
    ConfigurationError,
  );
});

test("config menerima role bot tanpa target dan webhook menuntut URL serta secret", () => {
  const config = parseConfig({
    TELEGRAM_BOT_TOKEN: "test-token",
    APP_ROLE: "bot",
    MONITOR_TARGETS_JSON: "[]",
  });
  expect(config.app.role).toBe("bot");
  expect(() =>
    parseConfig({
      TELEGRAM_BOT_TOKEN: "test-token",
      APP_ROLE: "bot",
      TELEGRAM_WEBHOOK_ENABLED: "true",
      TELEGRAM_WEBHOOK_URL: "https://example.test/webhook",
    }),
  ).toThrow(ConfigurationError);
});

test("mode Telegram diturunkan dari flag webhook dan menolak typo boolean", () => {
  const polling = parseConfig({
    TELEGRAM_BOT_TOKEN: "test-token",
    APP_ROLE: "bot",
    TELEGRAM_WEBHOOK_ENABLED: "false",
  });
  expect(polling.telegram.webhookEnabled).toBe(false);
  expect(polling.telegram.mode).toBe("polling");

  const webhook = parseConfig({
    TELEGRAM_BOT_TOKEN: "test-token",
    APP_ROLE: "bot",
    TELEGRAM_WEBHOOK_ENABLED: "true",
    TELEGRAM_WEBHOOK_URL: "https://example.test/webhook",
    TELEGRAM_WEBHOOK_SECRET: "secret",
  });
  expect(webhook.telegram.webhookEnabled).toBe(true);
  expect(webhook.telegram.mode).toBe("webhook");

  expect(() =>
    parseConfig({
      TELEGRAM_BOT_TOKEN: "test-token",
      APP_ROLE: "bot",
      TELEGRAM_WEBHOOK_ENABLED: "tru",
    }),
  ).toThrow(ConfigurationError);

  expect(() =>
    parseConfig({
      TELEGRAM_BOT_TOKEN: "test-token",
      APP_ROLE: "bot",
      TELEGRAM_MODE: "polling",
    }),
  ).toThrow(ConfigurationError);
});
