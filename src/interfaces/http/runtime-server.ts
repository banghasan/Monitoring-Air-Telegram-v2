import { Elysia } from "elysia";
import type { MonitorService } from "../../app/monitoring/monitor-service.js";
import type { AppConfig } from "../../config/config.js";
import type { StructuredLogger } from "../../infrastructure/logging/structured-logger.js";
import type { SqliteStateRepository } from "../../infrastructure/state/sqlite-state-repository.js";

export function createMonitorHttpServer(
  config: AppConfig,
  service: MonitorService,
  repository: SqliteStateRepository,
  logger: StructuredLogger,
) {
  return new Elysia({ name: "air-monitor-http" })
    .get("/health", () => ({ status: "ok", service: "monitor" }))
    .get("/ready", ({ set }) => {
      const status = service.getStatus();
      const ready = Boolean(status.lastSuccessAt) || !status.enabled;
      if (!ready) set.status = 503;
      return {
        status: ready ? "ready" : "not_ready",
        service: "monitor",
      };
    })
    .get("/internal/status", ({ headers, set }) => {
      const authorization = headers.authorization;
      if (
        !config.internal.statusToken ||
        authorization !== `Bearer ${config.internal.statusToken}`
      ) {
        set.status = 401;
        return { error: "unauthorized" };
      }
      const repositoryStatus = repository.status();
      return {
        monitor: service.getStatus(),
        repository: {
          ...repositoryStatus,
          snapshot: repositoryStatus.snapshot
            ? {
                updatedAt: repositoryStatus.snapshot.updatedAt,
                reading: {
                  stationName: repositoryStatus.snapshot.reading.stationName,
                  statusRaw: repositoryStatus.snapshot.reading.statusRaw,
                  observedAtRaw: repositoryStatus.snapshot.reading.observedAtRaw,
                },
              }
            : undefined,
        },
      };
    })
    .onError(({ code, error }) => {
      logger.error("http.error", "monitor http request failed", error, { code });
      return { error: "internal server error" };
    });
}

export function createBotHttpServer(
  config: AppConfig,
  webhookHandler: (request: Request, secret: string | undefined) => Promise<Response>,
  logger: StructuredLogger,
) {
  return new Elysia({ name: "air-bot-http" })
    .get("/health", () => ({ status: "ok", service: "bot" }))
    .get("/ready", () => ({ status: "ready", service: "bot", mode: config.telegram.mode }))
    .post("/telegram/webhook", async ({ request, headers }) => {
      const response = await webhookHandler(request, headers["x-telegram-bot-api-secret-token"]);
      if (response.status === 200) return { ok: true };
      return new Response(JSON.stringify({ error: "webhook rejected" }), {
        status: response.status,
        headers: { "content-type": "application/json" },
      });
    })
    .onError(({ code, error }) => {
      logger.error("http.error", "bot http request failed", error, { code });
      return { error: "internal server error" };
    });
}
