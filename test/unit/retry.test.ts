import { expect, test } from "bun:test";
import { StructuredLogger } from "../../src/infrastructure/logging/structured-logger.js";
import { retryLogger } from "../../src/infrastructure/retry/retry.js";

test("retry logger mencatat identitas chat dan thread target", () => {
  const lines: string[] = [];
  const logger = new StructuredLogger("bot", (line) => lines.push(line));
  const onRetry = retryLogger(logger, "manual air notification Monitoring", {
    target: "Monitoring",
    chat_id: "-1001234567890",
    thread_id: 5,
  });

  onRetry?.(1, 5, new Error("chat not found"));

  expect(JSON.parse(lines[0] ?? "{}")).toMatchObject({
    event: "worker.retry",
    operation: "manual air notification Monitoring",
    target: "Monitoring",
    chat_id: "-1001234567890",
    thread_id: 5,
    attempt: 1,
    delay_seconds: 5,
    error_message: "chat not found",
  });
});
