import type { AppConfig } from "../../config/config.js";
import { eventIdFor, statusChanged } from "../../domain/monitoring/notification-policy.js";
import type {
  MonitorRuntimeStatus,
  NotificationEvent,
  NotificationSender,
} from "../../domain/monitoring/types.js";
import { ANGKE_HULU_STATION_KEY, type WaterReading } from "../../domain/water/types.js";
import type { StructuredLogger } from "../../infrastructure/logging/structured-logger.js";
import { retryLogger, withRetry } from "../../infrastructure/retry/retry.js";
import {
  type PendingDelivery,
  type PersistedSnapshot,
  type SqliteStateRepository,
  targetKeyFor,
} from "../../infrastructure/state/sqlite-state-repository.js";

export interface MonitorSource {
  fetchReading(): Promise<WaterReading>;
}

export interface MonitorServiceOptions {
  config: AppConfig;
  source: MonitorSource;
  repository: SqliteStateRepository;
  sender: NotificationSender;
  logger: StructuredLogger;
  now?: () => Date;
}

export class MonitorService {
  private readonly now: () => Date;
  private readonly runtime: MonitorRuntimeStatus;
  private running = false;

  constructor(private readonly options: MonitorServiceOptions) {
    this.now = options.now ?? (() => new Date());
    this.runtime = {
      enabled: options.config.monitor.enabled,
      dryRun: options.config.monitor.dryRun,
      intervalSeconds: options.config.monitor.intervalSeconds,
      startedAt: this.now().toISOString(),
      pendingDeliveries: 0,
      failedDeliveries: 0,
    };
  }

  async runOnce(): Promise<void> {
    if (this.running) {
      this.options.logger.warn(
        "monitor.run.skipped",
        "monitor cycle skipped because another cycle is running",
      );
      return;
    }

    this.running = true;
    try {
      await this.runCycle();
    } finally {
      this.running = false;
      this.refreshDeliveryCounts();
    }
  }

  private async runCycle(): Promise<void> {
    const startedAt = this.now().toISOString();
    this.runtime.lastRunAt = startedAt;
    this.options.logger.info("monitor.run.start", "monitor cycle started", {
      station_query: this.options.config.water.stationQuery,
    });
    try {
      const reading = await withRetry(() => this.options.source.fetchReading(), {
        operation: "water source fetch",
        maxAttempts: this.options.config.monitor.upstreamMaxAttempts,
        backoffSeconds: this.options.config.monitor.upstreamRetryBackoffSeconds,
        onRetry: retryLogger(this.options.logger, "water source fetch"),
      });
      await this.processReading(reading);
      this.runtime.lastSuccessAt = this.now().toISOString();
      this.runtime.lastError = undefined;
      this.options.logger.info("monitor.run.success", "monitor cycle completed", {
        station_name: reading.stationName,
        status: reading.statusRaw,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.runtime.lastError = message;
      const snapshot = this.options.repository.getSnapshot(ANGKE_HULU_STATION_KEY);
      if (snapshot)
        this.options.repository.saveError(
          ANGKE_HULU_STATION_KEY,
          message,
          this.now().toISOString(),
        );
      this.options.logger.error("source.fetch.error", "monitor cycle failed", error, {
        station_query: this.options.config.water.stationQuery,
      });
    }
  }

  getStatus(): MonitorRuntimeStatus {
    this.refreshDeliveryCounts();
    return { ...this.runtime };
  }

  private async processReading(reading: WaterReading): Promise<void> {
    const previous = this.options.repository.getSnapshot(ANGKE_HULU_STATION_KEY);
    const fetchedAt = this.now().toISOString();
    const changed = previous ? statusChanged(previous.reading, reading) : false;
    if (!previous) {
      this.options.repository.saveSnapshot({
        stationKey: ANGKE_HULU_STATION_KEY,
        reading,
        updatedAt: fetchedAt,
        lastSuccessAt: fetchedAt,
      });
      this.options.logger.info("monitor.baseline", "valid reading stored as baseline", {
        station_name: reading.stationName,
        status: reading.statusRaw,
      });
    } else if (changed) {
      const eventId = eventIdFor(
        ANGKE_HULU_STATION_KEY,
        previous.reading.statusNormalized,
        reading,
      );
      const event: NotificationEvent = {
        eventId,
        stationKey: ANGKE_HULU_STATION_KEY,
        previousStatusRaw: previous.reading.statusRaw,
        currentStatusRaw: reading.statusRaw,
        reading,
        createdAt: fetchedAt,
      };
      const snapshot: PersistedSnapshot = {
        stationKey: ANGKE_HULU_STATION_KEY,
        reading,
        lastEventId: eventId,
        updatedAt: fetchedAt,
        lastSuccessAt: fetchedAt,
      };
      this.options.repository.saveEvent(
        { ...event, payload: event.reading },
        this.options.config.monitor.dryRun ? [] : this.options.config.monitor.targets,
        snapshot,
      );
      this.runtime.lastStatus = reading.statusRaw;
      this.runtime.sourceName = reading.stationName;
      this.options.logger.info("monitor.status_changed", "water status changed", {
        station_query: this.options.config.water.stationQuery,
        source_name: reading.stationName,
        previous_status: previous.reading.statusRaw,
        current_status: reading.statusRaw,
        observed_at: reading.observedAtRaw,
        dry_run: this.options.config.monitor.dryRun,
      });
    } else {
      this.options.repository.saveSnapshot({
        stationKey: ANGKE_HULU_STATION_KEY,
        reading,
        lastEventId: previous.lastEventId,
        updatedAt: fetchedAt,
        lastSuccessAt: fetchedAt,
      });
    }

    await this.processPendingDeliveries();
    this.runtime.lastStatus = reading.statusRaw;
    this.runtime.sourceName = reading.stationName;
  }

  private async processPendingDeliveries(): Promise<void> {
    if (this.options.config.monitor.dryRun) return;
    const pending = this.options.repository.listPendingDeliveries(this.now());
    for (const delivery of pending) await this.processDelivery(delivery);
  }

  private async processDelivery(delivery: PendingDelivery): Promise<void> {
    const maximum = this.options.config.monitor.telegramSendMaxAttempts;
    const remaining = maximum - delivery.attemptCount;
    if (remaining <= 0) return;
    const event: NotificationEvent = {
      eventId: delivery.event.eventId,
      stationKey: delivery.event.stationKey,
      previousStatusRaw: delivery.event.previousStatusRaw,
      currentStatusRaw: delivery.event.currentStatusRaw,
      reading: delivery.event.payload,
      createdAt: delivery.event.createdAt,
    };
    let attemptsUsed = 0;
    try {
      await withRetry(
        (attempt) => {
          attemptsUsed = attempt;
          return this.options.sender.send(delivery.target, event);
        },
        {
          operation: `telegram notification ${targetKeyFor(delivery.target)}`,
          maxAttempts: remaining,
          backoffSeconds: this.options.config.monitor.telegramSendRetryBackoffSeconds,
          onRetry: retryLogger(
            this.options.logger,
            `telegram notification ${delivery.target.label}`,
          ),
        },
      );
      this.options.repository.markDeliverySent(
        delivery.event.eventId,
        delivery.targetKey,
        this.now().toISOString(),
        delivery.attemptCount + attemptsUsed,
      );
      this.options.logger.info("notification.send.success", "notification sent", {
        event_id: delivery.event.eventId,
        target: delivery.target.label,
        attempt_count: delivery.attemptCount + attemptsUsed,
      });
    } catch (error) {
      const attemptCount = delivery.attemptCount + attemptsUsed;
      this.options.repository.markDeliveryAttempt(
        delivery.event.eventId,
        delivery.targetKey,
        attemptCount,
        error instanceof Error ? error.message : String(error),
      );
      this.options.logger.error("notification.send.error", "notification delivery failed", error, {
        event_id: delivery.event.eventId,
        target: delivery.target.label,
        attempt_count: attemptCount,
      });
    }
  }

  private refreshDeliveryCounts(): void {
    const status = this.options.repository.status();
    this.runtime.pendingDeliveries = status.pendingDeliveries;
    this.runtime.failedDeliveries = status.failedDeliveries;
  }
}
