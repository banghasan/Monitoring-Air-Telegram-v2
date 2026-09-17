import { startBot } from "./app/bot/bot-runtime.js";
import { parseConfig } from "./config/config.js";
import { StructuredLogger } from "./infrastructure/logging/structured-logger.js";

const config = parseConfig({ ...process.env, APP_ROLE: "bot" });
await startBot(config, new StructuredLogger("bot"));
