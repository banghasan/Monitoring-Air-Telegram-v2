import { expect, test } from "bun:test";
import type { WaterReading } from "../../src/domain/water/types.js";
import { WaterCache } from "../../src/infrastructure/cache/water-cache.js";

function reading(status = "Status : Normal"): WaterReading {
  return {
    stationKey: "angke-hulu",
    stationName: "P.S. Angke Hulu 1",
    displayName: "Angke",
    location: "Angke",
    observedAtRaw: "2026-09-17T15:10:00+07:00",
    observedAtIso: "2026-09-17T08:10:00.000Z",
    fetchedAt: "2026-09-17T08:10:00.000Z",
    heightRaw: -440,
    previousHeightRaw: -450,
    heightCm: -44,
    previousHeightCm: -45,
    statusRaw: status,
    statusNormalized: status.replace(/^Status : /, "").toUpperCase(),
    thresholds: { siaga1Raw: 3000, siaga2Raw: 2500, siaga3Raw: 1500, siaga4Raw: 1 },
    sourceUrl: "https://example.test",
    rawFields: {},
  };
}

test("cache memakai snapshot fresh selama TTL dan mencegah request paralel ganda", async () => {
  let now = 0;
  let calls = 0;
  let resolveFetch: ((value: WaterReading) => void) | undefined;
  const source = {
    fetchReading: () => {
      calls += 1;
      if (calls > 1) return Promise.resolve(reading());
      return new Promise<WaterReading>((resolve) => {
        resolveFetch = resolve;
      });
    },
  };
  const cache = new WaterCache(source, {
    ttlSeconds: 60,
    staleIfErrorSeconds: 120,
    now: () => now,
  });
  const first = cache.get();
  const second = cache.get();
  expect(calls).toBe(1);
  resolveFetch?.(reading());
  expect((await first).kind).toBe("fresh");
  expect((await second).kind).toBe("fresh");
  expect((await cache.get()).kind).toBe("cache");
  expect(calls).toBe(1);
  now = 61_000;
  expect((await cache.get()).kind).toBe("fresh");
  expect(calls).toBe(2);
});

test("cache menyajikan stale snapshot ketika upstream gagal dalam batas stale", async () => {
  let now = 0;
  let calls = 0;
  const source = {
    fetchReading: async () => {
      calls += 1;
      if (calls === 1) return reading();
      throw new Error("upstream down");
    },
  };
  const cache = new WaterCache(source, { ttlSeconds: 1, staleIfErrorSeconds: 10, now: () => now });
  await cache.get();
  now = 2_000;
  const result = await cache.get();
  expect(result.kind).toBe("stale");
  expect(result.lastError).toBe("upstream down");
});

test("cache menandai usia data sumber yang melewati batas konfigurasi", async () => {
  const source = { fetchReading: async () => reading() };
  const cache = new WaterCache(source, {
    ttlSeconds: 60,
    staleIfErrorSeconds: 120,
    maxDataAgeSeconds: 10,
    now: () => Date.parse("2026-09-17T08:11:00.000Z"),
  });
  const result = await cache.get();
  expect(result.sourceAgeSeconds).toBe(60);
  expect(result.sourceFresh).toBe(false);
});
