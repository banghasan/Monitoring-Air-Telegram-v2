import { Database } from "bun:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { NotificationTarget } from "../../config/config.js";
import type { WaterReading } from "../../domain/water/types.js";

export interface PersistedSnapshot {
  stationKey: string;
  reading: WaterReading;
  lastEventId?: string;
  lastError?: string;
  lastSuccessAt?: string;
  updatedAt: string;
}

export interface PersistedEvent {
  eventId: string;
  stationKey: string;
  previousStatusRaw: string;
  currentStatusRaw: string;
  payload: WaterReading;
  createdAt: string;
}

export interface PendingDelivery {
  event: PersistedEvent;
  target: NotificationTarget;
  targetKey: string;
  state: "pending" | "failed";
  attemptCount: number;
  nextRetryAt?: string;
  lastError?: string;
}

export interface DeliverySummary {
  eventId: string;
  targetKey: string;
  targetLabel: string;
  state: string;
  attemptCount: number;
  lastError?: string;
  sentAt?: string;
}

export interface RepositoryStatus {
  snapshot?: PersistedSnapshot;
  pendingDeliveries: number;
  failedDeliveries: number;
  lastDelivery?: DeliverySummary;
}

interface SnapshotRow {
  station_key: string;
  snapshot_json: string;
  status_normalized: string;
  last_event_id: string | null;
  last_error: string | null;
  last_success_at: string | null;
  updated_at: string;
}

interface EventRow {
  event_id: string;
  station_key: string;
  previous_status_raw: string;
  current_status_raw: string;
  payload_json: string;
  created_at: string;
}

interface DeliveryRow extends EventRow {
  target_key: string;
  target_label: string;
  chat_id: string;
  thread_id: number;
  state: "pending" | "failed";
  attempt_count: number;
  next_retry_at: string | null;
  last_error: string | null;
  sent_at: string | null;
}

export interface SqliteStateRepositoryOptions {
  migrationDir?: string;
}

export class SqliteStateRepository {
  private readonly db: Database;

  constructor(path: string, options: SqliteStateRepositoryOptions = {}) {
    if (path !== ":memory:") {
      const directory = dirname(resolve(path));
      mkdirSync(directory, { recursive: true });
    }
    this.db = new Database(path, { create: true, strict: true });
    this.db.exec(
      "PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;",
    );
    this.applyMigrations(options.migrationDir ?? "migrations");
  }

  close(): void {
    this.db.close();
  }

  getSnapshot(stationKey: string): PersistedSnapshot | undefined {
    const row = this.db
      .query<SnapshotRow, [string]>(
        "SELECT station_key, snapshot_json, status_normalized, last_event_id, last_error, last_success_at, updated_at FROM monitor_snapshot WHERE station_key = ?",
      )
      .get(stationKey);
    return row ? this.snapshotFromRow(row) : undefined;
  }

  saveSnapshot(snapshot: PersistedSnapshot): void {
    this.db
      .query(
        `INSERT INTO monitor_snapshot (station_key, snapshot_json, status_normalized, last_event_id, last_error, last_success_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(station_key) DO UPDATE SET
         snapshot_json = excluded.snapshot_json,
         status_normalized = excluded.status_normalized,
         last_event_id = excluded.last_event_id,
         last_error = excluded.last_error,
         last_success_at = excluded.last_success_at,
         updated_at = excluded.updated_at`,
      )
      .run(
        snapshot.stationKey,
        JSON.stringify(snapshot.reading),
        snapshot.reading.statusNormalized,
        snapshot.lastEventId ?? null,
        snapshot.lastError ?? null,
        snapshot.lastSuccessAt ?? null,
        snapshot.updatedAt,
      );
  }

  saveEvent(
    event: PersistedEvent,
    targets: NotificationTarget[],
    snapshot: PersistedSnapshot,
  ): void {
    const transaction = this.db.transaction(() => {
      this.db
        .query(
          `INSERT OR IGNORE INTO monitor_event
          (event_id, station_key, previous_status_raw, current_status_raw, payload_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          event.eventId,
          event.stationKey,
          event.previousStatusRaw,
          event.currentStatusRaw,
          JSON.stringify(event.payload),
          event.createdAt,
        );
      for (const target of targets) {
        const targetKey = targetKeyFor(target);
        this.db
          .query(
            `INSERT OR IGNORE INTO notification_delivery
            (event_id, target_key, target_label, chat_id, thread_id, state, attempt_count)
           VALUES (?, ?, ?, ?, ?, 'pending', 0)`,
          )
          .run(event.eventId, targetKey, target.label, String(target.chatId), target.threadId);
      }
      this.db
        .query(
          `INSERT INTO monitor_snapshot (station_key, snapshot_json, status_normalized, last_event_id, last_error, last_success_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(station_key) DO UPDATE SET
           snapshot_json = excluded.snapshot_json,
           status_normalized = excluded.status_normalized,
           last_event_id = excluded.last_event_id,
           last_error = excluded.last_error,
           last_success_at = excluded.last_success_at,
           updated_at = excluded.updated_at`,
        )
        .run(
          snapshot.stationKey,
          JSON.stringify(snapshot.reading),
          snapshot.reading.statusNormalized,
          snapshot.lastEventId ?? null,
          snapshot.lastError ?? null,
          snapshot.lastSuccessAt ?? null,
          snapshot.updatedAt,
        );
    });
    transaction();
  }

  saveError(stationKey: string, error: string, updatedAt: string): void {
    this.db
      .query("UPDATE monitor_snapshot SET last_error = ?, updated_at = ? WHERE station_key = ?")
      .run(error, updatedAt, stationKey);
  }

  listPendingDeliveries(now: Date): PendingDelivery[] {
    const rows = this.db
      .query<DeliveryRow, [string]>(
        `SELECT e.event_id, e.station_key, e.previous_status_raw, e.current_status_raw, e.payload_json, e.created_at,
              d.target_key, d.target_label, d.chat_id, d.thread_id, d.state, d.attempt_count,
              d.next_retry_at, d.last_error, d.sent_at
         FROM notification_delivery d
         JOIN monitor_event e ON e.event_id = d.event_id
        WHERE d.state IN ('pending', 'failed')
          AND (d.next_retry_at IS NULL OR d.next_retry_at <= ?)
        ORDER BY e.created_at ASC`,
      )
      .all(now.toISOString());
    return rows.map((row) => ({
      event: eventFromRow(row),
      target: {
        chatId: /^-?\d+$/.test(row.chat_id) ? Number(row.chat_id) : row.chat_id,
        threadId: row.thread_id,
        label: row.target_label,
      },
      targetKey: row.target_key,
      state: row.state,
      attemptCount: row.attempt_count,
      nextRetryAt: row.next_retry_at ?? undefined,
      lastError: row.last_error ?? undefined,
    }));
  }

  markDeliverySent(eventId: string, targetKey: string, sentAt: string, attemptCount: number): void {
    this.db
      .query(
        `UPDATE notification_delivery
          SET state = 'sent', sent_at = ?, attempt_count = ?, next_retry_at = NULL, last_error = NULL
        WHERE event_id = ? AND target_key = ?`,
      )
      .run(sentAt, attemptCount, eventId, targetKey);
  }

  markDeliveryAttempt(
    eventId: string,
    targetKey: string,
    attemptCount: number,
    error: string,
    nextRetryAt?: string,
  ): void {
    this.db
      .query(
        `UPDATE notification_delivery
          SET state = 'failed', attempt_count = ?, last_error = ?, next_retry_at = ?
        WHERE event_id = ? AND target_key = ?`,
      )
      .run(attemptCount, error, nextRetryAt ?? null, eventId, targetKey);
  }

  status(): RepositoryStatus {
    const snapshotRow = this.db
      .query<SnapshotRow, []>(
        "SELECT station_key, snapshot_json, status_normalized, last_event_id, last_error, last_success_at, updated_at FROM monitor_snapshot ORDER BY updated_at DESC LIMIT 1",
      )
      .get();
    const counts = this.db
      .query<{ pending: number; failed: number }, []>(
        `SELECT
        SUM(CASE WHEN state = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN state = 'failed' THEN 1 ELSE 0 END) AS failed
       FROM notification_delivery`,
      )
      .get();
    const lastDelivery = this.db
      .query<DeliverySummary & { last_error: string | null; sent_at: string | null }, []>(
        `SELECT event_id AS eventId, target_key AS targetKey, target_label AS targetLabel, state, attempt_count AS attemptCount,
              last_error, sent_at
         FROM notification_delivery ORDER BY COALESCE(sent_at, last_error) DESC LIMIT 1`,
      )
      .get();
    return {
      snapshot: snapshotRow ? this.snapshotFromRow(snapshotRow) : undefined,
      pendingDeliveries: Number(counts?.pending ?? 0),
      failedDeliveries: Number(counts?.failed ?? 0),
      lastDelivery: lastDelivery
        ? {
            eventId: lastDelivery.eventId,
            targetKey: lastDelivery.targetKey,
            targetLabel: lastDelivery.targetLabel,
            state: lastDelivery.state,
            attemptCount: lastDelivery.attemptCount,
            lastError: lastDelivery.last_error ?? undefined,
            sentAt: lastDelivery.sent_at ?? undefined,
          }
        : undefined,
    };
  }

  pruneEvents(beforeIso: string): void {
    this.db
      .query(
        `DELETE FROM monitor_event
        WHERE created_at < ?
          AND event_id NOT IN (SELECT event_id FROM notification_delivery WHERE state != 'sent')`,
      )
      .run(beforeIso);
  }

  private applyMigrations(migrationDir: string): void {
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);",
    );
    const files = ["001_initial_state.sql"];
    for (const file of files) {
      const version = Number(file.slice(0, 3));
      const alreadyApplied = this.db
        .query<{ version: number }, [number]>(
          "SELECT version FROM schema_migrations WHERE version = ?",
        )
        .get(version);
      if (alreadyApplied) continue;
      const contents = readFileSync(resolve(migrationDir, file), "utf8");
      const transaction = this.db.transaction(() => {
        this.db.exec(contents);
        this.db
          .query("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)")
          .run(version, new Date().toISOString());
      });
      transaction();
    }
  }

  private snapshotFromRow(row: SnapshotRow): PersistedSnapshot {
    return {
      stationKey: row.station_key,
      reading: JSON.parse(row.snapshot_json) as WaterReading,
      lastEventId: row.last_event_id ?? undefined,
      lastError: row.last_error ?? undefined,
      lastSuccessAt: row.last_success_at ?? undefined,
      updatedAt: row.updated_at,
    };
  }
}

function eventFromRow(row: EventRow): PersistedEvent {
  return {
    eventId: row.event_id,
    stationKey: row.station_key,
    previousStatusRaw: row.previous_status_raw,
    currentStatusRaw: row.current_status_raw,
    payload: JSON.parse(row.payload_json) as WaterReading,
    createdAt: row.created_at,
  };
}

export function targetKeyFor(target: NotificationTarget): string {
  return `${String(target.chatId)}:${target.threadId}`;
}
