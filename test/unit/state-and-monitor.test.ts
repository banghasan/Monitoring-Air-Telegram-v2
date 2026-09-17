import { expect, test } from "bun:test";
import { MonitorService } from "../../src/app/monitoring/monitor-service.js";
import { type AppConfig, parseConfig } from "../../src/config/config.js";
import type { NotificationEvent } from "../../src/domain/monitoring/types.js";
import type { WaterReading } from "../../src/domain/water/types.js";
import { StructuredLogger } from "../../src/infrastructure/logging/structured-logger.js";
import { SqliteStateRepository } from "../../src/infrastructure/state/sqlite-state-repository.js";

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
  return parseConfig({
    TELEGRAM_BOT_TOKEN: "test-token",
    APP_ROLE: "monitor",
    MONITOR_TARGETS_JSON: '[{"chat_id":"-100123","thread_id":42,"label":"Test"}]',
    INTERNAL_STATUS_URL: "http://monitor:3000/internal/status",
    INTERNAL_STATUS_TOKEN: "secret",
    TELEGRAM_SEND_MAX_ATTEMPTS: "1",
    UPSTREAM_MAX_ATTEMPTS: "1",
  });
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
