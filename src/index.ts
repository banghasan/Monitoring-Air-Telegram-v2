import { startBot } from "./app/bot/bot-runtime.js";
import { startMonitor } from "./app/monitoring/monitor-runtime.js";
import { parseConfig } from "./config/config.js";
import { StructuredLogger } from "./infrastructure/logging/structured-logger.js";

const config = parseConfig();
const logger = new StructuredLogger(config.app.role);

logger.info("config.validated", "configuration validated", {
  role: config.app.role,
  mode: config.telegram.mode,
  version: config.app.version,
});

if (config.app.role === "bot") {
  await startBot(config, logger);
} else {
  await startMonitor(config, logger);
}
