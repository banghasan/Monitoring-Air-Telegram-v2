export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogRecord {
  ts: string;
  level: LogLevel;
  service: string;
  event: string;
  message: string;
  [key: string]: unknown;
}

export type LogSink = (line: string, level: LogLevel) => void;

function safeError(error: unknown): Record<string, string> {
  if (error instanceof Error) {
    return { error_name: error.name, error_message: error.message };
  }
  return { error_message: String(error) };
}

export class StructuredLogger {
  constructor(
    private readonly service: string,
    private readonly sink: LogSink = (line, level) => {
      if (level === "error") console.error(line);
      else console.log(line);
    },
  ) {}

  debug(event: string, message: string, fields: Record<string, unknown> = {}): void {
    this.write("debug", event, message, fields);
  }

  info(event: string, message: string, fields: Record<string, unknown> = {}): void {
    this.write("info", event, message, fields);
  }

  warn(event: string, message: string, fields: Record<string, unknown> = {}): void {
    this.write("warn", event, message, fields);
  }

  error(
    event: string,
    message: string,
    error?: unknown,
    fields: Record<string, unknown> = {},
  ): void {
    this.write("error", event, message, {
      ...fields,
      ...(error === undefined ? {} : safeError(error)),
    });
  }

  private write(
    level: LogLevel,
    event: string,
    message: string,
    fields: Record<string, unknown>,
  ): void {
    const record: LogRecord = {
      ts: new Date().toISOString(),
      level,
      service: this.service,
      event,
      message,
      ...fields,
    };
    this.sink(JSON.stringify(record), level);
  }
}
