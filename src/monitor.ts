import { startMonitor } from "./app/monitoring/monitor-runtime.js";
import { parseConfig } from "./config/config.js";
import { StructuredLogger } from "./infrastructure/logging/structured-logger.js";

const config = parseConfig({ ...process.env, APP_ROLE: "monitor" });
await startMonitor(config, new StructuredLogger("monitor"));
