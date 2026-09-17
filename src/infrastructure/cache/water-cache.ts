import type { CacheResult, CacheSnapshot, WaterReading } from "../../domain/water/types.js";

export interface WaterCacheOptions {
  ttlSeconds: number;
  staleIfErrorSeconds: number;
  maxDataAgeSeconds?: number;
  now?: () => number;
}

export interface CachedWaterSource {
  fetchReading(): Promise<WaterReading>;
}

export class WaterCache {
  private snapshot?: CacheSnapshot;
  private inFlight?: Promise<CacheResult>;
  private readonly now: () => number;

  constructor(
    private readonly source: CachedWaterSource,
    private readonly options: WaterCacheOptions,
  ) {
    this.now = options.now ?? Date.now;
  }

  async get(forceRefresh = false): Promise<CacheResult> {
    const now = this.now();
    if (!forceRefresh && this.snapshot && now < this.snapshot.expiresAt) {
      return this.result(this.snapshot.reading, "cache", this.snapshot.lastError, now);
    }
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.refresh(now);
    try {
      return await this.inFlight;
    } finally {
      this.inFlight = undefined;
    }
  }

  getSnapshot(): CacheSnapshot | undefined {
    return this.snapshot;
  }

  invalidate(): void {
    if (this.snapshot) this.snapshot.expiresAt = 0;
  }

  private async refresh(now: number): Promise<CacheResult> {
    try {
      const reading = await this.source.fetchReading();
      this.snapshot = {
        reading,
        fetchedAt: reading.fetchedAt,
        expiresAt: now + this.options.ttlSeconds * 1000,
        staleUntil: now + this.options.staleIfErrorSeconds * 1000,
      };
      return this.result(reading, "fresh", undefined, now);
    } catch (error) {
      if (this.snapshot && now < this.snapshot.staleUntil) {
        const message = error instanceof Error ? error.message : String(error);
        this.snapshot.lastError = message;
        this.snapshot.expiresAt = 0;
        return this.result(this.snapshot.reading, "stale", message, now);
      }
      throw error;
    }
  }

  private result(
    reading: WaterReading,
    kind: CacheResult["kind"],
    lastError: string | undefined,
    now: number,
  ): CacheResult {
    const observedAtMs = reading.observedAtIso ? Date.parse(reading.observedAtIso) : Number.NaN;
    const sourceAgeSeconds = Number.isNaN(observedAtMs)
      ? undefined
      : Math.max(0, (now - observedAtMs) / 1000);
    const sourceFresh =
      sourceAgeSeconds === undefined || this.options.maxDataAgeSeconds === undefined
        ? true
        : sourceAgeSeconds <= this.options.maxDataAgeSeconds;
    return {
      reading,
      kind,
      fetchedAt: reading.fetchedAt,
      lastError,
      sourceAgeSeconds,
      sourceFresh,
    };
  }
}
