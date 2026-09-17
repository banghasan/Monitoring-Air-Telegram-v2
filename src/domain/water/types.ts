export const ANGKE_HULU_STATION_KEY = "angke-hulu";

export type WaterTrend = "rising" | "falling" | "steady" | "unknown";

export interface WaterThresholds {
  siaga1Raw: number;
  siaga2Raw: number;
  siaga3Raw: number;
  siaga4Raw: number;
}

export interface WaterReading {
  stationKey: string;
  stationName: string;
  displayName: string;
  location: string;
  sourceId?: string;
  stationCode?: string;
  latitude?: number;
  longitude?: number;
  observedAtRaw: string;
  observedAtIso?: string;
  fetchedAt: string;
  heightRaw: number;
  previousHeightRaw?: number;
  heightCm: number;
  previousHeightCm?: number;
  statusRaw: string;
  statusNormalized: string;
  thresholds: WaterThresholds;
  sourceUrl: string;
  rawFields: Record<string, string>;
}

export interface CacheSnapshot {
  reading: WaterReading;
  fetchedAt: string;
  expiresAt: number;
  staleUntil: number;
  lastError?: string;
}

export type CacheResultKind = "fresh" | "cache" | "stale";

export interface CacheResult {
  reading: WaterReading;
  kind: CacheResultKind;
  fetchedAt: string;
  lastError?: string;
  sourceAgeSeconds?: number;
  sourceFresh: boolean;
}
