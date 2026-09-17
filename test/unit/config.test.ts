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
      TELEGRAM_MODE: "webhook",
      TELEGRAM_WEBHOOK_URL: "https://example.test/webhook",
    }),
  ).toThrow(ConfigurationError);
});
