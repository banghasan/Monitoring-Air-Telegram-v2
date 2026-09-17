import { XMLParser } from "fast-xml-parser";
import { ANGKE_HULU_STATION_KEY, type WaterReading } from "../../domain/water/types.js";
import { normalizeStatus } from "../../domain/water/water-policy.js";

export class WaterSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WaterSourceError";
  }
}

export class StationNotFoundError extends WaterSourceError {}
export class StationAmbiguousError extends WaterSourceError {}

export interface XmlWaterSourceOptions {
  sourceUrl: string;
  stationQuery: string;
  stationDisplayName: string;
  timeoutSeconds: number;
  fetcher?: typeof fetch;
  now?: () => Date;
}

type XmlRecord = Record<string, unknown>;

function normalizeSearch(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleUpperCase("id-ID");
}

function collectRecords(value: unknown, records: XmlRecord[] = []): XmlRecord[] {
  if (Array.isArray(value)) {
    for (const item of value) collectRecords(item, records);
    return records;
  }
  if (!value || typeof value !== "object") return records;
  const object = value as XmlRecord;
  if (typeof object.NAMA_PINTU_AIR === "string") records.push(object);
  for (const child of Object.values(object)) collectRecords(child, records);
  return records;
}

function text(record: XmlRecord, key: string): string | undefined {
  const value = record[key];
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value[0] === undefined ? undefined : String(value[0]).trim();
  return String(value).trim();
}

function requiredText(record: XmlRecord, key: string): string {
  const value = text(record, key);
  if (!value) throw new WaterSourceError(`field ${key} kosong pada record station`);
  return value;
}

function numberValue(record: XmlRecord, key: string, required = true): number | undefined {
  const value = text(record, key);
  if (!value) {
    if (required) throw new WaterSourceError(`field ${key} kosong pada record station`);
    return undefined;
  }
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed)) {
    if (required) throw new WaterSourceError(`field ${key} bukan angka valid`);
    return undefined;
  }
  return parsed;
}

function parseObservedAt(raw: string): string | undefined {
  const date = new Date(raw);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

function fieldsAsStrings(record: XmlRecord): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, String(value ?? "").trim()]),
  );
}

export function parseAngkeHuluXml(
  xml: string,
  options: Pick<XmlWaterSourceOptions, "stationQuery" | "stationDisplayName" | "sourceUrl"> & {
    fetchedAt?: string;
  },
): WaterReading {
  const parser = new XMLParser({ trimValues: true, ignoreAttributes: false });
  let parsed: unknown;
  try {
    parsed = parser.parse(xml);
  } catch (error) {
    throw new WaterSourceError(
      `XML tidak dapat diparse: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const records = collectRecords(parsed);
  const query = normalizeSearch(options.stationQuery);
  const matches = records.filter((record) =>
    normalizeSearch(String(record.NAMA_PINTU_AIR)).includes(query),
  );
  if (matches.length === 0)
    throw new StationNotFoundError(`station tidak ditemukan: ${options.stationQuery}`);
  if (matches.length > 1)
    throw new StationAmbiguousError(
      `station ambigu: ${options.stationQuery} (${matches.length} record)`,
    );

  const record = matches[0];
  if (!record) throw new StationNotFoundError(`station tidak ditemukan: ${options.stationQuery}`);
  const observedAtRaw = requiredText(record, "TANGGAL");
  const parsedHeightRaw = numberValue(record, "TINGGI_AIR");
  if (parsedHeightRaw === undefined)
    throw new WaterSourceError("field TINGGI_AIR kosong pada record station");
  const heightRaw = parsedHeightRaw;
  const previousHeightRaw = numberValue(record, "TINGGI_AIR_SEBELUMNYA", false);
  const statusRaw = requiredText(record, "STATUS_SIAGA");
  const latitude = numberValue(record, "LATITUDE", false);
  const longitude = numberValue(record, "LONGITUDE", false);
  const fetchedAt = options.fetchedAt ?? new Date().toISOString();

  return {
    stationKey: ANGKE_HULU_STATION_KEY,
    stationName: requiredText(record, "NAMA_PINTU_AIR"),
    displayName: options.stationDisplayName,
    location: text(record, "LOKASI") ?? "",
    sourceId: text(record, "ID_PINTU_AIR"),
    stationCode: text(record, "KODE_STASIUN"),
    latitude,
    longitude,
    observedAtRaw,
    observedAtIso: parseObservedAt(observedAtRaw),
    fetchedAt,
    heightRaw,
    previousHeightRaw,
    heightCm: heightRaw / 10,
    previousHeightCm: previousHeightRaw === undefined ? undefined : previousHeightRaw / 10,
    statusRaw,
    statusNormalized: normalizeStatus(statusRaw),
    thresholds: {
      siaga1Raw: numberValue(record, "SIAGA1") ?? 0,
      siaga2Raw: numberValue(record, "SIAGA2") ?? 0,
      siaga3Raw: numberValue(record, "SIAGA3") ?? 0,
      siaga4Raw: numberValue(record, "SIAGA4") ?? 0,
    },
    sourceUrl: options.sourceUrl,
    rawFields: fieldsAsStrings(record),
  };
}

export class XmlWaterSource {
  private readonly fetcher: typeof fetch;
  private readonly now: () => Date;

  constructor(private readonly options: XmlWaterSourceOptions) {
    this.fetcher = options.fetcher ?? fetch;
    this.now = options.now ?? (() => new Date());
  }

  async fetchReading(signal?: AbortSignal): Promise<WaterReading> {
    const response = await this.fetcher(this.options.sourceUrl, {
      method: "GET",
      headers: { accept: "application/xml,text/xml;q=0.9,*/*;q=0.1" },
      signal: signal ?? AbortSignal.timeout(this.options.timeoutSeconds * 1000),
    });
    if (!response.ok) throw new WaterSourceError(`upstream HTTP ${response.status}`);
    const xml = await response.text();
    if (!xml.trim()) throw new WaterSourceError("upstream XML kosong");
    return parseAngkeHuluXml(xml, {
      stationQuery: this.options.stationQuery,
      stationDisplayName: this.options.stationDisplayName,
      sourceUrl: this.options.sourceUrl,
      fetchedAt: this.now().toISOString(),
    });
  }
}
