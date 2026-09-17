import { expect, test } from "bun:test";
import { MonitorService } from "../../src/app/monitoring/monitor-service.js";
import { parseConfig } from "../../src/config/config.js";
import { StructuredLogger } from "../../src/infrastructure/logging/structured-logger.js";
import { SqliteStateRepository } from "../../src/infrastructure/state/sqlite-state-repository.js";
import {
  createBotHttpServer,
  createMonitorHttpServer,
} from "../../src/interfaces/http/runtime-server.js";

test("monitor HTTP expose health, readiness, dan endpoint internal terproteksi", async () => {
  const config = parseConfig({
    TELEGRAM_BOT_TOKEN: "test-token",
    APP_ROLE: "monitor",
    MONITOR_DRY_RUN: "true",
    MONITOR_TARGETS_JSON: "[]",
    INTERNAL_STATUS_TOKEN: "test-secret",
    INTERNAL_STATUS_URL: "http://monitor:3000/internal/status",
  });
  const repository = new SqliteStateRepository(":memory:");
  const source = {
    fetchReading: async () => {
      throw new Error("not called");
    },
  };
  const sender = { send: async () => undefined };
  const service = new MonitorService({
    config,
    source,
    repository,
    sender,
    logger: new StructuredLogger("test", () => undefined),
  });
  const app = createMonitorHttpServer(
    config,
    service,
    repository,
    new StructuredLogger("test", () => undefined),
  );

  const health = await app.handle(new Request("http://localhost/health"));
  expect(health.status).toBe(200);
  expect(await health.json()).toEqual({ status: "ok", service: "monitor" });

  const unauthorized = await app.handle(new Request("http://localhost/internal/status"));
  expect(unauthorized.status).toBe(401);

  const authorized = await app.handle(
    new Request("http://localhost/internal/status", {
      headers: { authorization: "Bearer test-secret" },
    }),
  );
  expect(authorized.status).toBe(200);
  const body = (await authorized.json()) as { monitor: { intervalSeconds: number } };
  expect(body.monitor.intervalSeconds).toBe(60);
  repository.close();
});

test("bot webhook HTTP hanya menerima secret yang dikonfigurasi", async () => {
  const config = parseConfig({
    TELEGRAM_BOT_TOKEN: "test-token",
    APP_ROLE: "bot",
    TELEGRAM_MODE: "webhook",
    TELEGRAM_WEBHOOK_URL: "https://example.test/telegram/webhook",
    TELEGRAM_WEBHOOK_SECRET: "webhook-secret",
  });
  let receivedSecret: string | undefined;
  const app = createBotHttpServer(
    config,
    async (_request, secret) => {
      receivedSecret = secret;
      return secret === "webhook-secret"
        ? new Response("ok", { status: 200 })
        : new Response("unauthorized", { status: 401 });
    },
    new StructuredLogger("test", () => undefined),
  );

  const unauthorized = await app.handle(
    new Request("http://localhost/telegram/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
  );
  expect(unauthorized.status).toBe(401);

  const authorized = await app.handle(
    new Request("http://localhost/telegram/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "webhook-secret",
      },
      body: "{}",
    }),
  );
  expect(authorized.status).toBe(200);
  expect(await authorized.json()).toEqual({ ok: true });
  expect(receivedSecret).toBe("webhook-secret");
});
