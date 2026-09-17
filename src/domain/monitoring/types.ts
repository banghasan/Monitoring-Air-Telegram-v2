import type { NotificationTarget } from "../../config/config.js";
import type { WaterReading } from "../water/types.js";

export interface MonitorRuntimeStatus {
  enabled: boolean;
  dryRun: boolean;
  intervalSeconds: number;
  startedAt: string;
  lastRunAt?: string;
  lastSuccessAt?: string;
  lastError?: string;
  lastStatus?: string;
  sourceName?: string;
  pendingDeliveries: number;
  failedDeliveries: number;
}

export interface NotificationEvent {
  eventId: string;
  stationKey: string;
  previousStatusRaw: string;
  currentStatusRaw: string;
  reading: WaterReading;
  createdAt: string;
}

export interface NotificationSender {
  send(target: NotificationTarget, event: NotificationEvent): Promise<void>;
}
