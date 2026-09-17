import type { WaterReading } from "../water/types.js";

export function statusChanged(
  previous: Pick<WaterReading, "statusNormalized">,
  current: Pick<WaterReading, "statusNormalized">,
): boolean {
  return previous.statusNormalized !== current.statusNormalized;
}

export function eventIdFor(
  stationKey: string,
  previousStatus: string,
  reading: WaterReading,
): string {
  const sourceTime = reading.observedAtIso ?? reading.observedAtRaw;
  return `${stationKey}:${previousStatus}->${reading.statusNormalized}:${sourceTime}`;
}
