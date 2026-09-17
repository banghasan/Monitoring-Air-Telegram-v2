import type { AppConfig } from "../../config/config.js";

export interface InternalMonitorStatus {
  status: "ok" | "unknown";
  monitor?: {
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
  };
  repository?: {
    snapshot?: {
      reading: { stationName: string; statusRaw: string; observedAtRaw: string };
      updatedAt: string;
    };
    pendingDeliveries: number;
    failedDeliveries: number;
    lastDelivery?: { targetLabel: string; state: string; attemptCount: number; lastError?: string };
  };
  error?: string;
}

export async function fetchInternalMonitorStatus(
  config: AppConfig,
): Promise<InternalMonitorStatus> {
  if (!config.internal.statusUrl || !config.internal.statusToken) {
    return { status: "unknown", error: "internal status endpoint belum dikonfigurasi" };
  }
  try {
    const response = await fetch(config.internal.statusUrl, {
      headers: { authorization: `Bearer ${config.internal.statusToken}` },
      signal: AbortSignal.timeout(config.water.upstreamTimeoutSeconds * 1000),
    });
    if (!response.ok) return { status: "unknown", error: `monitor HTTP ${response.status}` };
    const body = (await response.json()) as Omit<InternalMonitorStatus, "status">;
    return { status: "ok", ...body };
  } catch (error) {
    return { status: "unknown", error: error instanceof Error ? error.message : String(error) };
  }
}
