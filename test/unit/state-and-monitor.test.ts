import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { MonitorService } from "../../src/app/monitoring/monitor-service.js";
import { type AppConfig, parseConfig } from "../../src/config/config.js";
import type { NotificationEvent } from "../../src/domain/monitoring/types.js";
import type { WaterReading } from "../../src/domain/water/types.js";
import { StructuredLogger } from "../../src/infrastructure/logging/structured-logger.js";
import {
  SqliteStateRepository,
  targetKeyFor,
} from "../../src/infrastructure/state/sqlite-state-repository.js";

function makeReading(status: string, heightRaw: number): WaterReading {
  return {
    stationKey: "angke-hulu",
    stationName: "P.S. Angke Hulu 1",
    displayName: "Angke",
    location: "Angke",
    observedAtRaw: "2026-09-17T15:10:00+07:00",
    observedAtIso: "2026-09-17T08:10:00.000Z",
    fetchedAt: "2026-09-17T08:10:00.000Z",
    heightRaw,
    previousHeightRaw: heightRaw - 10,
    heightCm: heightRaw / 10,
    previousHeightCm: (heightRaw - 10) / 10,
    statusRaw: `Status : ${status}`,
    statusNormalized: status.toUpperCase(),
    thresholds: { siaga1Raw: 3000, siaga2Raw: 2500, siaga3Raw: 1500, siaga4Raw: 1 },
    sourceUrl: "https://example.test",
    rawFields: {},
  };
}

function config(): AppConfig {
  return parseConfig(configEnvironment());
}

function configEnvironment(): Record<string, string> {
  return {
    TELEGRAM_BOT_TOKEN: "test-token",
    APP_ROLE: "monitor",
    MONITOR_TARGETS_JSON: '[{"chat_id":"-100123","thread_id":42,"label":"Test"}]',
    INTERNAL_STATUS_URL: "http://monitor:3000/internal/status",
    INTERNAL_STATUS_TOKEN: "secret",
    TELEGRAM_SEND_MAX_ATTEMPTS: "1",
    UPSTREAM_MAX_ATTEMPTS: "1",
  };
}

test("repository menyimpan baseline, event, dan delivery state", () => {
  const repository = new SqliteStateRepository(":memory:");
  const reading = makeReading("Normal", -440);
  repository.saveSnapshot({
    stationKey: "angke-hulu",
    reading,
    updatedAt: "2026-09-17T08:10:00.000Z",
  });
  expect(repository.getSnapshot("angke-hulu")?.reading.heightRaw).toBe(-440);
  repository.close();
});

test("repository menyimpan delivery group dan channel tanpa thread", () => {
  const repository = new SqliteStateRepository(":memory:");
  const reading = makeReading("Siaga 3", -420);
  const event = {
    eventId: "event-multi-target",
    stationKey: "angke-hulu",
    previousStatusRaw: "Status : Normal",
    currentStatusRaw: "Status : Siaga 3",
    payload: reading,
    createdAt: "2026-09-17T08:10:00.000Z",
  };
  repository.saveEvent(
    event,
    [
      { chatId: -100123, threadId: 42, label: "Monitoring" },
      { chatId: -100456, label: "Channel" },
    ],
    {
      stationKey: "angke-hulu",
      reading,
      lastEventId: event.eventId,
      updatedAt: event.createdAt,
      lastSuccessAt: event.createdAt,
    },
  );

  const deliveries = repository.listPendingDeliveries(new Date("2026-09-17T08:11:00.000Z"));
  expect(deliveries).toHaveLength(2);
  expect(deliveries.map((delivery) => delivery.target.threadId)).toEqual([42, undefined]);
  expect(deliveries[0]?.targetKey).toBe("-100123:42");
  expect(deliveries[1]?.targetKey).toBe("-100456:no-thread");
  expect(targetKeyFor({ chatId: -100456, label: "Channel" })).toBe("-100456:no-thread");
  repository.close();
});

test("migration mempertahankan delivery lama dan membuka thread kosong untuk channel", () => {
  const directory = mkdtempSync(join(process.cwd(), ".tmp-monitor-migration-"));
  const databasePath = join(directory, "monitor.sqlite");
  const reading = makeReading("Siaga 3", -420);
  try {
    const legacy = new Database(databasePath, { create: true, strict: true });
    legacy.exec(readFileSync(resolve(process.cwd(), "migrations/001_initial_state.sql"), "utf8"));
    legacy.exec(
      "CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);",
    );
    legacy
      .query("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)")
      .run(1, "2026-09-17T08:00:00.000Z");
    legacy
      .query(
        `INSERT INTO monitor_event
          (event_id, station_key, previous_status_raw, current_status_raw, payload_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "legacy-event",
        "angke-hulu",
        "Status : Normal",
        "Status : Siaga 3",
        JSON.stringify(reading),
        "2026-09-17T08:00:00.000Z",
      );
    legacy
      .query(
        `INSERT INTO notification_delivery
          (event_id, target_key, target_label, chat_id, thread_id, state, attempt_count)
         VALUES (?, ?, ?, ?, ?, 'pending', 0)`,
      )
      .run("legacy-event", "-100123:42", "Legacy", "-100123", 42);
    legacy.close();

    const repository = new SqliteStateRepository(databasePath);
    repository.saveEvent(
      {
        eventId: "channel-event",
        stationKey: "angke-hulu",
        previousStatusRaw: "Status : Siaga 3",
        currentStatusRaw: "Status : Siaga 2",
        payload: reading,
        createdAt: "2026-09-17T08:01:00.000Z",
      },
      [{ chatId: -100456, label: "Channel" }],
      {
        stationKey: "angke-hulu",
        reading,
        lastEventId: "channel-event",
        updatedAt: "2026-09-17T08:01:00.000Z",
        lastSuccessAt: "2026-09-17T08:01:00.000Z",
      },
    );

    const deliveries = repository.listPendingDeliveries(new Date("2026-09-17T08:02:00.000Z"));
    expect(deliveries).toHaveLength(2);
    expect(deliveries.find((delivery) => delivery.target.label === "Legacy")?.target.threadId).toBe(
      42,
    );
    expect(
      deliveries.find((delivery) => delivery.target.label === "Channel")?.target.threadId,
    ).toBeUndefined();
    repository.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("monitor hanya mengirim ketika status berubah dan tidak mengirim baseline", async () => {
  const repository = new SqliteStateRepository(":memory:");
  const readings = [
    makeReading("Normal", -440),
    makeReading("Normal", -430),
    makeReading("Siaga 3", -420),
  ];
  const sent: NotificationEvent[] = [];
  const source = { fetchReading: async () => readings.shift() ?? makeReading("Siaga 3", -420) };
  const sender = {
    send: async (_target: AppConfig["monitor"]["targets"][number], event: NotificationEvent) => {
      sent.push(event);
    },
  };
  const logger = new StructuredLogger("test", () => undefined);
  const service = new MonitorService({ config: config(), source, repository, sender, logger });

  await service.runOnce();
  await service.runOnce();
  await service.runOnce();
  await service.runOnce();

  expect(sent).toHaveLength(1);
  expect(sent[0]?.previousStatusRaw).toBe("Status : Normal");
  expect(sent[0]?.currentStatusRaw).toBe("Status : Siaga 3");
  expect(repository.status().pendingDeliveries).toBe(0);
  repository.close();
});

test("monitor mengirim perubahan ke semua target secara independen", async () => {
  const repository = new SqliteStateRepository(":memory:");
  const readings = [makeReading("Normal", -440), makeReading("Siaga 3", -420)];
  const source = { fetchReading: async () => readings.shift() ?? makeReading("Siaga 3", -420) };
  const sent: AppConfig["monitor"]["targets"] = [];
  const sender = {
    send: async (target: AppConfig["monitor"]["targets"][number]) => {
      sent.push(target);
    },
  };
  const multiTargetConfig = parseConfig({
    ...configEnvironment(),
    MONITOR_TARGETS_JSON:
      '[{"chat_id":"-100123","thread_id":42,"label":"Monitoring"},{"chat_id":"-100456","label":"Channel"}]',
  });
  const logger = new StructuredLogger("test", () => undefined);
  const service = new MonitorService({
    config: multiTargetConfig,
    source,
    repository,
    sender,
    logger,
  });

  await service.runOnce();
  await service.runOnce();

  expect(sent).toHaveLength(2);
  expect(sent.map((target) => target.chatId)).toEqual([-100123, -100456]);
  expect(sent.map((target) => target.threadId)).toEqual([42, undefined]);
  repository.close();
});

test("monitor upstream gagal tanpa mengirim notifikasi", async () => {
  const repository = new SqliteStateRepository(":memory:");
  const sent: NotificationEvent[] = [];
  const source = {
    fetchReading: async () => {
      throw new Error("offline");
    },
  };
  const sender = {
    send: async (_target: AppConfig["monitor"]["targets"][number], event: NotificationEvent) => {
      sent.push(event);
    },
  };
  const logger = new StructuredLogger("test", () => undefined);
  const service = new MonitorService({ config: config(), source, repository, sender, logger });
  await service.runOnce();
  expect(sent).toHaveLength(0);
  expect(service.getStatus().lastError).toBe("offline");
  repository.close();
});

test("monitor melewati siklus yang tumpang tindih", async () => {
  const repository = new SqliteStateRepository(":memory:");
  let resolveReading: ((reading: WaterReading) => void) | undefined;
  let fetchCalls = 0;
  const source = {
    fetchReading: async () => {
      fetchCalls += 1;
      return new Promise<WaterReading>((resolve) => {
        resolveReading = resolve;
      });
    },
  };
  const sender = { send: async () => undefined };
  const logger = new StructuredLogger("test", () => undefined);
  const service = new MonitorService({ config: config(), source, repository, sender, logger });

  const firstRun = service.runOnce();
  const skippedRun = service.runOnce();
  expect(fetchCalls).toBe(1);
  resolveReading?.(makeReading("Normal", -440));
  await Promise.all([firstRun, skippedRun]);

  expect(repository.getSnapshot("angke-hulu")?.reading.statusNormalized).toBe("NORMAL");
  repository.close();
});

test("delivery gagal berhenti setelah batas attempt dan tidak diulang tanpa batas", async () => {
  const repository = new SqliteStateRepository(":memory:");
  const readings = [
    makeReading("Normal", -440),
    makeReading("Siaga 3", -420),
    makeReading("Siaga 3", -410),
  ];
  let sendCalls = 0;
  const source = { fetchReading: async () => readings.shift() ?? makeReading("Siaga 3", -410) };
  const sender = {
    send: async () => {
      sendCalls += 1;
      throw new Error("telegram unavailable");
    },
  };
  const logger = new StructuredLogger("test", () => undefined);
  const failureConfig = parseConfig({
    TELEGRAM_BOT_TOKEN: "test-token",
    APP_ROLE: "monitor",
    MONITOR_TARGETS_JSON: '[{"chat_id":"-100123","thread_id":42,"label":"Test"}]',
    INTERNAL_STATUS_URL: "http://monitor:3000/internal/status",
    INTERNAL_STATUS_TOKEN: "secret",
    TELEGRAM_SEND_MAX_ATTEMPTS: "2",
    TELEGRAM_SEND_RETRY_BACKOFF_SECONDS: "0",
    UPSTREAM_MAX_ATTEMPTS: "1",
  });
  const service = new MonitorService({ config: failureConfig, source, repository, sender, logger });
  await service.runOnce();
  await service.runOnce();
  await service.runOnce();
  expect(sendCalls).toBe(2);
  expect(repository.status().failedDeliveries).toBe(1);
  repository.close();
});
