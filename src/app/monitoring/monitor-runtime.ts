import type { AppConfig } from "../../config/config.js";
import type { StructuredLogger } from "../../infrastructure/logging/structured-logger.js";
import { XmlWaterSource } from "../../infrastructure/source/xml-water-source.js";
import { SqliteStateRepository } from "../../infrastructure/state/sqlite-state-repository.js";
import { TelegramRichClient } from "../../infrastructure/telegram/telegram-client.js";
import { createMonitorHttpServer } from "../../interfaces/http/runtime-server.js";
import { MonitorService } from "./monitor-service.js";
import { TelegramNotificationSender } from "./telegram-notification-sender.js";

export async function startMonitor(config: AppConfig, logger: StructuredLogger): Promise<void> {
  const repository = openMonitorStateRepository(config.monitor.stateDbPath, logger);
  if (!repository) {
    process.exitCode = 1;
    return;
  }
  const source = new XmlWaterSource({
    sourceUrl: config.water.sourceUrl,
    stationQuery: config.water.stationQuery,
    stationDisplayName: config.water.stationDisplayName,
    timeoutSeconds: config.water.upstreamTimeoutSeconds,
  });
  const client = new TelegramRichClient(config.telegram.token);
  const sender = new TelegramNotificationSender(client, config);
  const service = new MonitorService({ config, source, repository, sender, logger });
  const app = createMonitorHttpServer(config, service, repository, logger);
  app.listen({ hostname: "0.0.0.0", port: config.app.port });
  logger.info("app.start", "monitor http server started", {
    port: config.app.port,
    interval_seconds: config.monitor.intervalSeconds,
  });

  const run = (): void => {
    void service.runOnce();
  };
  if (config.monitor.enabled) {
    run();
    const interval = setInterval(run, config.monitor.intervalSeconds * 1000);
    const shutdown = (): void => {
      clearInterval(interval);
      repository.close();
      app
        .stop()
        .catch((error) =>
          logger.error("app.shutdown.error", "monitor http shutdown failed", error),
        );
      logger.info("app.shutdown", "monitor shutdown requested");
    };
    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
  } else {
    logger.warn("monitor.disabled", "monitor is disabled by configuration");
  }
}

export function openMonitorStateRepository(
  stateDbPath: string,
  logger: StructuredLogger,
): SqliteStateRepository | undefined {
  try {
    return new SqliteStateRepository(stateDbPath);
  } catch (error) {
    logger.error(
      "state.database.init_failed",
      "monitor state database could not be opened for read/write",
      error,
      { state_db_path: stateDbPath },
    );
    return undefined;
  }
}
