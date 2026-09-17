import type { WaterReading, WaterThresholds, WaterTrend } from "./types.js";

export function normalizeStatus(value: string): string {
  return value
    .replace(/^status\s*:\s*/i, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function trendFromReading(
  reading: Pick<WaterReading, "heightRaw" | "previousHeightRaw">,
): WaterTrend {
  if (reading.previousHeightRaw === undefined) return "unknown";
  if (reading.heightRaw > reading.previousHeightRaw) return "rising";
  if (reading.heightRaw < reading.previousHeightRaw) return "falling";
  return "steady";
}

export function trendLabel(trend: WaterTrend): string {
  if (trend === "rising") return "📈 Naik";
  if (trend === "falling") return "📉 Turun";
  if (trend === "steady") return "➡️ Tetap";
  return "❔ Tidak tersedia";
}

export function statusEmoji(status: string): string {
  const normalized = normalizeStatus(status);
  if (normalized.includes("SIAGA 1") || normalized.includes("BAHAYA")) return "🔴";
  if (normalized.includes("SIAGA 2") || normalized === "SIAGA") return "🟡";
  if (normalized.includes("SIAGA 3") || normalized.includes("WASPADA")) return "🔵";
  if (normalized.includes("NORMAL")) return "🟢";
  return "⚪";
}

export function cmFromRaw(raw: number): number {
  return raw / 10;
}

export function formatCm(raw: number | undefined): string {
  if (raw === undefined) return "tidak tersedia";
  const cm = cmFromRaw(raw);
  return Number.isInteger(cm) ? `${cm}` : cm.toFixed(1).replace(/\.0$/, "");
}

export function thresholdCm(threshold: number): string {
  return formatCm(threshold);
}

export function thresholdSummary(thresholds: WaterThresholds): string[] {
  return [
    `🔴 > ${thresholdCm(thresholds.siaga1Raw)} cm (BAHAYA)`,
    `🟡 ${thresholdCm(thresholds.siaga2Raw)}–${thresholdCm(thresholds.siaga1Raw)} cm (SIAGA)`,
    `🔵 ${thresholdCm(thresholds.siaga3Raw)}–${thresholdCm(thresholds.siaga2Raw)} cm (WASPADA)`,
    `🟢 < ${thresholdCm(thresholds.siaga3Raw)} cm (Normal)`,
  ];
}

export function formatObservedAt(
  reading: Pick<WaterReading, "observedAtRaw" | "observedAtIso">,
  timezone: string,
): string {
  if (!reading.observedAtIso) return `${reading.observedAtRaw} WIB`;
  const date = new Date(reading.observedAtIso);
  if (Number.isNaN(date.valueOf())) return `${reading.observedAtRaw} WIB`;
  return `${new Intl.DateTimeFormat("id-ID", {
    timeZone: timezone,
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date)} WIB`;
}

export function formatFetchedAt(iso: string, timezone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return `${iso} WIB`;
  return `${new Intl.DateTimeFormat("id-ID", {
    timeZone: timezone,
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date)} WIB`;
}
