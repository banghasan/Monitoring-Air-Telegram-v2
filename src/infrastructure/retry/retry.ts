import type { StructuredLogger } from "../logging/structured-logger.js";

export interface RetryOptions {
  operation: string;
  maxAttempts: number;
  backoffSeconds: number[];
  sleep?: (milliseconds: number) => Promise<void>;
  onRetry?: (attempt: number, delaySeconds: number, error: unknown) => void;
}

const defaultSleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function withRetry<T>(
  action: (attempt: number) => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const sleep = options.sleep ?? defaultSleep;
  let lastError: unknown;
  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    try {
      return await action(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= options.maxAttempts) break;
      const delaySeconds =
        options.backoffSeconds[attempt - 1] ?? options.backoffSeconds.at(-1) ?? 0;
      options.onRetry?.(attempt, delaySeconds, error);
      if (delaySeconds > 0) await sleep(delaySeconds * 1000);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${options.operation} gagal`);
}

export function retryLogger(logger: StructuredLogger, operation: string): RetryOptions["onRetry"] {
  return (attempt, delaySeconds, error) => {
    logger.warn("worker.retry", "retry scheduled", {
      operation,
      attempt,
      delay_seconds: delaySeconds,
      ...(error instanceof Error ? { error_message: error.message } : {}),
    });
  };
}
