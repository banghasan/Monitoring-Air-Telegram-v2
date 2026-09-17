import packageInfo from "../../package.json" with { type: "json" };

export type AppRole = "bot" | "monitor";
export type TelegramMode = "polling" | "webhook";
export type TelegramChatId = number | string;

export interface NotificationTarget {
  chatId: TelegramChatId;
  threadId: number;
  label: string;
}

export interface AppConfig {
  app: {
    version: string;
    role: AppRole;
    environment: string;
    port: number;
    timezone: string;
    logLevel: string;
    logFormat: "json";
  };
  telegram: {
    token: string;
    mode: TelegramMode;
    ownerId?: number;
    adminIds: number[];
    webhookUrl?: string;
    webhookSecret?: string;
  };
  water: {
    sourceUrl: string;
    stationQuery: string;
    stationDisplayName: string;
    cacheTtlSeconds: number;
    cacheRefreshSeconds: number;
    staleIfErrorSeconds: number;
    maxDataAgeSeconds: number;
    upstreamTimeoutSeconds: number;
  };
  monitor: {
    enabled: boolean;
    intervalSeconds: number;
    dryRun: boolean;
    stateDbPath: string;
    targets: NotificationTarget[];
    upstreamMaxAttempts: number;
    upstreamRetryBackoffSeconds: number[];
    telegramSendMaxAttempts: number;
    telegramSendRetryBackoffSeconds: number[];
  };
  internal: {
    statusUrl?: string;
    statusToken?: string;
  };
  publicCommandCooldownSeconds: number;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

const DEFAULTS = {
  appVersion: packageInfo.version,
  role: "bot" as AppRole,
  environment: "development",
  port: 3000,
  timezone: "Asia/Jakarta",
  logLevel: "info",
  sourceUrl: "https://poskobanjir.dsdadki.web.id/xmldata.xml",
  stationQuery: "Angke Hulu",
  stationDisplayName: "P.S. Angke Hulu (Baru)",
  cacheTtlSeconds: 60,
  cacheRefreshSeconds: 60,
  staleIfErrorSeconds: 900,
  maxDataAgeSeconds: 600,
  upstreamTimeoutSeconds: 5,
  monitorIntervalSeconds: 60,
  upstreamMaxAttempts: 3,
  telegramSendMaxAttempts: 3,
  publicCommandCooldownSeconds: 1,
};

type Environment = Record<string, string | undefined>;

function required(environment: Environment, key: string): string {
  const value = environment[key]?.trim();
  if (!value) {
    throw new ConfigurationError(`${key} wajib diisi`);
  }
  return value;
}

function text(environment: Environment, key: string, fallback: string): string {
  return environment[key]?.trim() || fallback;
}

function positiveNumber(environment: Environment, key: string, fallback: number): number {
  const value = environment[key]?.trim();
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ConfigurationError(`${key} harus berupa angka positif`);
  }
  return parsed;
}

function positiveInteger(environment: Environment, key: string, fallback: number): number {
  const parsed = positiveNumber(environment, key, fallback);
  if (!Number.isInteger(parsed)) {
    throw new ConfigurationError(`${key} harus berupa bilangan bulat positif`);
  }
  return parsed;
}

function booleanValue(environment: Environment, key: string, fallback: boolean): boolean {
  const value = environment[key]?.trim().toLowerCase();
  if (!value) return fallback;
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  throw new ConfigurationError(`${key} harus berupa boolean`);
}

function optionalNumber(environment: Environment, key: string): number | undefined {
  const value = environment[key]?.trim();
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new ConfigurationError(`${key} harus berupa Telegram user ID integer`);
  }
  return parsed;
}

function parseIdList(environment: Environment, key: string): number[] {
  const value = environment[key]?.trim();
  if (!value) return [];
  return value.split(",").map((item) => {
    const parsed = Number(item.trim());
    if (!Number.isSafeInteger(parsed)) {
      throw new ConfigurationError(`${key} berisi user ID yang tidak valid`);
    }
    return parsed;
  });
}

function parseBackoff(environment: Environment, key: string, fallback: number[]): number[] {
  const value = environment[key]?.trim();
  if (!value) return fallback;
  const parsed = value.split(",").map((item) => Number(item.trim()));
  if (parsed.some((item) => !Number.isFinite(item) || item < 0)) {
    throw new ConfigurationError(`${key} harus berisi angka detik yang valid`);
  }
  return parsed;
}

function parseChatId(value: unknown): TelegramChatId {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (typeof value !== "string" || !value.trim()) {
    throw new ConfigurationError("MONITOR_TARGETS_JSON.chat_id wajib berupa string atau integer");
  }
  const normalized = value.trim();
  if (/^-?\d+$/.test(normalized)) return Number(normalized);
  if (/^@[A-Za-z0-9_]{5,}$/.test(normalized)) return normalized;
  throw new ConfigurationError(
    "MONITOR_TARGETS_JSON.chat_id harus berupa numeric ID atau @username",
  );
}

function parseTargets(environment: Environment): NotificationTarget[] {
  const raw = environment.MONITOR_TARGETS_JSON?.trim() || "[]";
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new ConfigurationError("MONITOR_TARGETS_JSON harus berupa JSON valid");
  }
  if (!Array.isArray(value)) {
    throw new ConfigurationError("MONITOR_TARGETS_JSON harus berupa array");
  }
  return value.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new ConfigurationError(`target ke-${index + 1} tidak valid`);
    }
    const target = item as Record<string, unknown>;
    const threadId = target.thread_id;
    if (!Number.isSafeInteger(threadId) || Number(threadId) <= 0) {
      throw new ConfigurationError(`target ke-${index + 1} wajib memiliki thread_id positif`);
    }
    const label =
      typeof target.label === "string" && target.label.trim()
        ? target.label.trim()
        : `target-${index + 1}`;
    return { chatId: parseChatId(target.chat_id), threadId: Number(threadId), label };
  });
}

function validateCrossFieldRules(config: AppConfig): void {
  if (
    config.monitor.enabled &&
    config.app.role === "monitor" &&
    !config.monitor.dryRun &&
    config.monitor.targets.length !== 1
  ) {
    throw new ConfigurationError("role monitor membutuhkan tepat satu target Telegram pada MVP");
  }
  if (
    config.telegram.mode === "webhook" &&
    (!config.telegram.webhookUrl || !config.telegram.webhookSecret)
  ) {
    throw new ConfigurationError(
      "TELEGRAM_WEBHOOK_URL dan TELEGRAM_WEBHOOK_SECRET wajib untuk mode webhook",
    );
  }
  if (config.internal.statusUrl && !config.internal.statusToken) {
    throw new ConfigurationError("INTERNAL_STATUS_TOKEN wajib jika INTERNAL_STATUS_URL diisi");
  }
  if (config.internal.statusToken && !config.internal.statusUrl) {
    throw new ConfigurationError("INTERNAL_STATUS_URL wajib jika INTERNAL_STATUS_TOKEN diisi");
  }
  if (
    config.monitor.upstreamMaxAttempts > 1 &&
    config.monitor.upstreamRetryBackoffSeconds.length > config.monitor.upstreamMaxAttempts - 1
  ) {
    throw new ConfigurationError("UPSTREAM_RETRY_BACKOFF_SECONDS terlalu banyak");
  }
  if (
    config.monitor.telegramSendMaxAttempts > 1 &&
    config.monitor.telegramSendRetryBackoffSeconds.length >
      config.monitor.telegramSendMaxAttempts - 1
  ) {
    throw new ConfigurationError("TELEGRAM_SEND_RETRY_BACKOFF_SECONDS terlalu banyak");
  }
}

export function parseConfig(environment: Environment = process.env): AppConfig {
  const role = text(environment, "APP_ROLE", DEFAULTS.role);
  if (role !== "bot" && role !== "monitor") {
    throw new ConfigurationError("APP_ROLE harus bot atau monitor");
  }
  const mode = text(environment, "TELEGRAM_MODE", "polling");
  if (mode !== "polling" && mode !== "webhook") {
    throw new ConfigurationError("TELEGRAM_MODE harus polling atau webhook");
  }

  const config: AppConfig = {
    app: {
      version: DEFAULTS.appVersion,
      role,
      environment: text(environment, "NODE_ENV", DEFAULTS.environment),
      port: positiveInteger(environment, "PORT", DEFAULTS.port),
      timezone: text(environment, "TIMEZONE", DEFAULTS.timezone),
      logLevel: text(environment, "LOG_LEVEL", DEFAULTS.logLevel),
      logFormat: "json",
    },
    telegram: {
      token: required(environment, "TELEGRAM_BOT_TOKEN"),
      mode,
      ownerId: optionalNumber(environment, "TELEGRAM_OWNER_ID"),
      adminIds: parseIdList(environment, "TELEGRAM_ADMIN_IDS"),
      webhookUrl: environment.TELEGRAM_WEBHOOK_URL?.trim() || undefined,
      webhookSecret: environment.TELEGRAM_WEBHOOK_SECRET?.trim() || undefined,
    },
    water: {
      sourceUrl: text(environment, "WATER_SOURCE_URL", DEFAULTS.sourceUrl),
      stationQuery: text(environment, "WATER_STATION_QUERY", DEFAULTS.stationQuery),
      stationDisplayName: text(
        environment,
        "WATER_STATION_DISPLAY_NAME",
        DEFAULTS.stationDisplayName,
      ),
      cacheTtlSeconds: positiveNumber(environment, "CACHE_TTL_SECONDS", DEFAULTS.cacheTtlSeconds),
      cacheRefreshSeconds: positiveNumber(
        environment,
        "CACHE_REFRESH_SECONDS",
        DEFAULTS.cacheRefreshSeconds,
      ),
      staleIfErrorSeconds: positiveNumber(
        environment,
        "STALE_IF_ERROR_SECONDS",
        DEFAULTS.staleIfErrorSeconds,
      ),
      maxDataAgeSeconds: positiveNumber(
        environment,
        "MAX_DATA_AGE_SECONDS",
        DEFAULTS.maxDataAgeSeconds,
      ),
      upstreamTimeoutSeconds: positiveNumber(
        environment,
        "UPSTREAM_TIMEOUT_SECONDS",
        DEFAULTS.upstreamTimeoutSeconds,
      ),
    },
    monitor: {
      enabled: booleanValue(environment, "MONITOR_ENABLED", true),
      intervalSeconds: positiveInteger(
        environment,
        "MONITOR_INTERVAL_SECONDS",
        DEFAULTS.monitorIntervalSeconds,
      ),
      dryRun: booleanValue(environment, "MONITOR_DRY_RUN", false),
      stateDbPath: text(environment, "MONITOR_STATE_DB_PATH", "./data/state/monitor.sqlite"),
      targets: parseTargets(environment),
      upstreamMaxAttempts: positiveInteger(
        environment,
        "UPSTREAM_MAX_ATTEMPTS",
        DEFAULTS.upstreamMaxAttempts,
      ),
      upstreamRetryBackoffSeconds: parseBackoff(
        environment,
        "UPSTREAM_RETRY_BACKOFF_SECONDS",
        [5, 15],
      ),
      telegramSendMaxAttempts: positiveInteger(
        environment,
        "TELEGRAM_SEND_MAX_ATTEMPTS",
        DEFAULTS.telegramSendMaxAttempts,
      ),
      telegramSendRetryBackoffSeconds: parseBackoff(
        environment,
        "TELEGRAM_SEND_RETRY_BACKOFF_SECONDS",
        [5, 15],
      ),
    },
    internal: {
      statusUrl: environment.INTERNAL_STATUS_URL?.trim() || undefined,
      statusToken: environment.INTERNAL_STATUS_TOKEN?.trim() || undefined,
    },
    publicCommandCooldownSeconds: positiveNumber(
      environment,
      "PUBLIC_COMMAND_COOLDOWN_SECONDS",
      DEFAULTS.publicCommandCooldownSeconds,
    ),
  };

  if (!config.water.stationQuery) {
    throw new ConfigurationError("WATER_STATION_QUERY wajib diisi");
  }
  const configuredVersion = environment.APP_VERSION?.trim();
  if (configuredVersion && configuredVersion !== DEFAULTS.appVersion) {
    throw new ConfigurationError(
      `APP_VERSION harus sama dengan package.json (${DEFAULTS.appVersion})`,
    );
  }
  validateCrossFieldRules(config);
  return config;
}
